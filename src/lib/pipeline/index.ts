// src/lib/pipeline/index.ts
// The main analysis pipeline.
// Orchestrates: normalize → cache check → retrieval → scoring → synthesis → cache write
// This is the single entry point for all analysis logic.

import type {
  AnalysisRequest,
  AnalysisResult,
  EvidenceBundle,
  ApiResponse
} from "@/types";
import { normalizeClaim_full } from "@/lib/normalize/claim";
import { getCache, CacheKeys } from "@/lib/cache";
import { searchWithFallback } from "@/lib/providers/search";
import { queryFactChecks } from "@/lib/providers/factcheck";
import { getClaimContext } from "@/lib/providers/context";
import { scoreSources, deduplicateSources } from "@/lib/scoring/sources";
import { rulesSynthesisProvider } from "@/lib/providers/synthesis/rules";
import { synthesisProviders } from "@/lib/providers/synthesis";
import { checkSynthesisBudget, consumeSynthesisBudget } from "@/lib/quota";
import { getPrisma } from "@/lib/db";

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "3600");
const CACHE_STALE = parseInt(process.env.CACHE_STALE_SECONDS || "86400");

// ── EVIDENCE ASSEMBLY ─────────────────────────────────────────────────────────
async function assembleEvidence(
  claim: ReturnType<typeof normalizeClaim_full>
): Promise<EvidenceBundle> {
  if (!claim.isCheckable) {
    return {
      sources: [],
      supporting: [],
      opposing: [],
      neutral: [],
      factChecks: [],
      wikiContext: null,
      hasConflict: false,
      evidenceStrength: "none",
    };
  }

  // Run all retrievals in parallel for speed
  const [rawSearchResults, factChecks, wikiContext] = await Promise.allSettled([
    // Multiple search queries in parallel
    Promise.all(
      claim.searchQueries.map((q) => searchWithFallback(q, 5))
    ).then((results) => results.flat()),
    queryFactChecks(claim.original),
    getClaimContext(claim.wikiQuery),
  ]);

  const rawSources =
    rawSearchResults.status === "fulfilled" ? rawSearchResults.value : [];
  const fcResults =
    factChecks.status === "fulfilled" ? factChecks.value : [];
  const wiki =
    wikiContext.status === "fulfilled" ? wikiContext.value : null;

  // Deduplicate and score
  const deduplicated = deduplicateSources(rawSources);
  const scored = scoreSources(deduplicated, claim.original);

  const supporting = scored.filter((s) => s.stance === "supports");
  const opposing = scored.filter((s) => s.stance === "opposes");
  const neutral = scored.filter((s) => s.stance === "neutral");

  // Conflict detection: credible sources on both sides
  const credibleSupport = supporting.filter((s) => s.credibility >= 3);
  const credibleOppose = opposing.filter((s) => s.credibility >= 3);
  const hasConflict =
    credibleSupport.length > 0 && credibleOppose.length > 0;

  // Evidence strength
  const total = supporting.length + opposing.length;
  const hasFactChecks = fcResults.length > 0;
  const evidenceStrength =
    hasFactChecks || total >= 4
      ? "strong"
      : total >= 2
      ? "moderate"
      : total === 1
      ? "weak"
      : "none";

  return {
    sources: scored,
    supporting,
    opposing,
    neutral,
    factChecks: fcResults,
    wikiContext: wiki,
    hasConflict,
    evidenceStrength,
  };
}

// ── PERSIST RESULT ────────────────────────────────────────────────────────────
async function persistResult(
  claim: ReturnType<typeof normalizeClaim_full>,
  result: AnalysisResult
): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.analysis.upsert({
      where: { claimHash: claim.hash },
      create: {
        claimHash: claim.hash,
        rawClaim: claim.original,
        normalizedClaim: claim.normalized,
        verdict: result.verdict,
        confidence: result.confidence,
        headline: result.headline,
        summary: result.summary,
        category: result.category,
        reasoning: JSON.stringify(result.reasoning),
        sources: JSON.stringify(result.sources),
        evidenceBreakdown: JSON.stringify(result.evidenceBreakdown),
        radar: JSON.stringify(result.radar),
        warnings: JSON.stringify(result.warnings),
        cacheStatus: result.cacheStatus,
        latencyMs: result.latencyMs,
        synthesisMode: result.synthesisMode,
      },
      update: {
        verdict: result.verdict,
        confidence: result.confidence,
        headline: result.headline,
        summary: result.summary,
        cacheStatus: result.cacheStatus,
        latencyMs: result.latencyMs,
        synthesisMode: result.synthesisMode,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[Pipeline] Failed to persist result:", err);
    // Non-fatal
  }
}

async function logUsageEvent(
  eventType: string,
  mode: string,
  latencyMs: number,
  ipHash?: string,
  errorCode?: string
): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.usageEvent.create({
      data: { eventType, synthesisMode: mode, latencyMs, ipHash, errorCode },
    });
  } catch {
    // Non-fatal
  }
}

// ── HISTORY SAVE ──────────────────────────────────────────────────────────────
async function saveToHistory(
  sessionId: string,
  analysisId: string,
  claim: string,
  verdict: string,
  confidence: number
): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.historyEntry.create({
      data: {
        sessionId,
        analysisId,
        claimPreview: claim.slice(0, 120),
        verdict,
        confidence,
      },
    });
  } catch {
    // Non-fatal
  }
}

// ── MAIN PIPELINE ─────────────────────────────────────────────────────────────
export async function runAnalysisPipeline(
  request: AnalysisRequest
): Promise<ApiResponse> {
  const pipelineStart = Date.now();

  // 1. NORMALIZE
  const claim = normalizeClaim_full(request.claim);

  // If the query is vague or weak, we do not fail hard.
  // Instead we degrade gracefully to AI or rules synthesis and return a
  // conservative UNVERIFIED / MIXED style response with a warning.
  const clarificationWarning = claim.clarificationNeeded
    ? claim.clarificationHint || "This claim could use more context for a precise verification."
    : null;

  // 2. CACHE CHECK
  const cache = await getCache();
  const cacheKey = CacheKeys.analysis(claim.hash);

  const cached = await cache.get<{ data: AnalysisResult; cachedAt: number }>(cacheKey);
  if (cached) {
    const ageSeconds = (Date.now() - cached.cachedAt) / 1000;
    const cacheStatus = ageSeconds < CACHE_TTL ? "hit" : "stale";

    await logUsageEvent("cache_hit", cached.data.synthesisMode, Date.now() - pipelineStart, request.ipHash);

    const result: AnalysisResult = {
      ...cached.data,
      cacheStatus,
      latencyMs: Date.now() - pipelineStart,
    };

    if (request.sessionId) {
      await saveToHistory(request.sessionId, claim.hash, request.claim, result.verdict, result.confidence);
    }

    return { ok: true, data: result };
  }

  // 3. RETRIEVAL
  let evidence: EvidenceBundle;
  try {
    evidence = await assembleEvidence(claim);
  } catch (err) {
    console.error("[Pipeline] Retrieval failed:", err);
    evidence = {
      sources: [],
      supporting: [],
      opposing: [],
      neutral: [],
      factChecks: [],
      wikiContext: null,
      hasConflict: false,
      evidenceStrength: "none",
    };
  }

  // 4. SYNTHESIS — choose provider
  let synthesisResult: Omit<AnalysisResult, "cacheStatus" | "latencyMs" | "synthesisMode"> | undefined;
  let synthesisMode: AnalysisResult["synthesisMode"] = "rules";

  const aiAvailable = (await checkSynthesisBudget()) && synthesisProviders.some((p) => p.isAvailable());
  const preferAI =
    aiAvailable &&
    (claim.isCheckable
      ? evidence.evidenceStrength === "none" ||
        evidence.evidenceStrength === "weak" ||
        evidence.hasConflict ||
        claim.clarificationNeeded
      : claim.clarificationNeeded);

  if (preferAI) {
    const providers = synthesisProviders.filter((p) => p.isAvailable());
    let lastErr: unknown = null;
    for (const provider of providers) {
      try {
        synthesisResult = await provider.synthesize(claim, evidence);
        synthesisMode = provider.name as AnalysisResult["synthesisMode"];
        await consumeSynthesisBudget();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[Pipeline] ${provider.name} synthesis failed:`, err);
      }
    }

    if (lastErr) {
      console.error("[Pipeline] All AI synthesis providers failed, using rules fallback:", lastErr);
      synthesisResult = await rulesSynthesisProvider.synthesize(claim, evidence);
      synthesisMode = "rules";
    }
  } else {
    synthesisResult = await rulesSynthesisProvider.synthesize(claim, evidence);
    synthesisMode = "rules";
  }

  const finalSynthesis = synthesisResult ?? (await rulesSynthesisProvider.synthesize(claim, evidence));
  const latencyMs = Date.now() - pipelineStart;

  const result: AnalysisResult = {
    ...finalSynthesis,
    factChecks: evidence.factChecks,
    warnings: clarificationWarning
      ? [...(finalSynthesis.warnings || []), clarificationWarning]
      : finalSynthesis.warnings,
    cacheStatus: "miss",
    latencyMs,
    synthesisMode,
  };

  // 5. CACHE WRITE
  await cache.set(cacheKey, { data: result, cachedAt: Date.now() }, CACHE_STALE);

  // 6. PERSIST & LOG
  await persistResult(claim, result);
  await logUsageEvent("analysis", synthesisMode, latencyMs, request.ipHash);

  if (request.sessionId) {
    await saveToHistory(request.sessionId, claim.hash, request.claim, result.verdict, result.confidence);
  }

  return { ok: true, data: result };
}
