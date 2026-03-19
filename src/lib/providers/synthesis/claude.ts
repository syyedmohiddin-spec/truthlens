// src/lib/providers/synthesis/claude.ts
// Claude-based synthesis provider.
// SERVER-SIDE ONLY. Never imported by client components.
// Receives pre-processed evidence — Claude is the last step, not the first.
// Has retry logic, timeout protection, and fallback JSON parsing.

import Anthropic from "@anthropic-ai/sdk";
import type {
  NormalizedClaim,
  EvidenceBundle,
  AnalysisResult,
  SynthesisProvider,
  ScoredSource,
  ReasoningStep,
} from "@/types";
import { rulesSynthesisProvider } from "./rules";

const SYNTHESIS_SYSTEM_PROMPT = `You are TruthLens, an expert fact-checking AI. Your job is to synthesize pre-retrieved evidence into a structured verdict.

CRITICAL RULES:
1. You receive pre-retrieved evidence. Do NOT claim to have searched the web yourself.
2. NEVER invent sources. Only reference the sources provided to you.
3. Be calibrated: use UNVERIFIED when evidence is insufficient, not when you are uncertain.
4. Separate what the evidence shows from your synthesis.
5. Always explain uncertainty honestly.
6. If claim is opinion or satire, say so clearly.
7. Return ONLY valid JSON. No markdown, no backticks, no commentary.

VERDICT RULES:
- TRUE: evidence strongly supports (weighted credibility ratio >= 0.75)
- FALSE: evidence strongly contradicts (weighted credibility ratio <= 0.25)
- MIXED: evidence is divided, claim is oversimplified, or context is critical
- UNVERIFIED: insufficient evidence, uncheckable, or claim is opinion/satire

OUTPUT CONTRACT: Return exactly this JSON shape, nothing else:
{
  "verdict": "TRUE|FALSE|MIXED|UNVERIFIED",
  "confidence": 0-100,
  "headline": "One punchy sentence under 12 words",
  "summary": "2-3 clear sentences for a general audience. No jargon.",
  "category": "scientific|political|historical|health|financial|geographical|cultural|legal|opinion|satire|other",
  "reasoning": [
    {"step": "...", "icon": "...", "color": "#hex", "text": "..."}
  ],
  "warnings": []
}`;

function buildPrompt(claim: NormalizedClaim, evidence: EvidenceBundle): string {
  const sourceSummary = [
    ...evidence.supporting.slice(0, 4).map(
      (s) => `[SUPPORTS] ${s.domain} (cred ${s.credibility}/5): "${s.snippet.slice(0, 200)}"`
    ),
    ...evidence.opposing.slice(0, 4).map(
      (s) => `[OPPOSES] ${s.domain} (cred ${s.credibility}/5): "${s.snippet.slice(0, 200)}"`
    ),
    ...evidence.neutral.slice(0, 2).map(
      (s) => `[NEUTRAL] ${s.domain} (cred ${s.credibility}/5): "${s.snippet.slice(0, 150)}"`
    ),
  ].join("\n");

  const factCheckSummary =
    evidence.factChecks.length > 0
      ? `\nPROFESSIONAL FACT-CHECKS:\n${evidence.factChecks
          .slice(0, 3)
          .map((fc) => `- ${fc.publisher}: "${fc.rating}" (${fc.reviewDate || "undated"})`)
          .join("\n")}`
      : "";

  const wikiSummary = evidence.wikiContext
    ? `\nWIKIPEDIA CONTEXT (${evidence.wikiContext.title}):\n"${evidence.wikiContext.extract.slice(0, 400)}"`
    : "";

  return `CLAIM TO FACT-CHECK:
"${claim.original}"

CLAIM CLASSIFICATION:
- Intent: ${claim.intent}
- Category: ${claim.category}
- Checkable: ${claim.isCheckable}
- Key entities: ${claim.keyEntities.join(", ") || "none identified"}

PRE-RETRIEVED EVIDENCE (${evidence.supporting.length} supporting, ${evidence.opposing.length} opposing, ${evidence.neutral.length} neutral):
${sourceSummary || "No relevant sources found."}
${factCheckSummary}
${wikiSummary}

Synthesize the above evidence into a verdict. Return only JSON.`;
}

function safeParseJson(text: string): Record<string, unknown> | null {
  // Remove markdown code fences if present
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Find the outermost JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function validateSynthesisResult(obj: Record<string, unknown>): boolean {
  const validVerdicts = ["TRUE", "FALSE", "MIXED", "UNVERIFIED"];
  return (
    typeof obj.verdict === "string" &&
    validVerdicts.includes(obj.verdict) &&
    typeof obj.confidence === "number" &&
    obj.confidence >= 0 &&
    obj.confidence <= 100 &&
    typeof obj.headline === "string" &&
    typeof obj.summary === "string" &&
    Array.isArray(obj.reasoning)
  );
}

// ── CLAUDE PROVIDER ───────────────────────────────────────────────────────────
class ClaudeSynthesisProvider implements SynthesisProvider {
  name = "claude";
  private client: Anthropic | null = null;

  isAvailable(): boolean {
    return !!(
      process.env.ANTHROPIC_API_KEY &&
      process.env.ENABLE_AI_SYNTHESIS === "true"
    );
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      });
    }
    return this.client;
  }

  async synthesize(
    claim: NormalizedClaim,
    evidence: EvidenceBundle
  ): Promise<Omit<AnalysisResult, "cacheStatus" | "latencyMs" | "synthesisMode">> {
    const client = this.getClient();
    const prompt = buildPrompt(claim, evidence);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await Promise.race([
          client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            system: SYNTHESIS_SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Claude timeout")), 30000)
          ),
        ]);

        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("No text content in Claude response");
        }

        const parsed = safeParseJson(textBlock.text);
        if (!parsed || !validateSynthesisResult(parsed)) {
          throw new Error("Invalid JSON structure from Claude");
        }

        // Merge AI reasoning with existing source data
        // (Claude should not re-invent sources — use pre-scored sources)
        const allSources: ScoredSource[] = [
          ...evidence.supporting,
          ...evidence.opposing,
          ...evidence.neutral,
        ].slice(0, 8);

        return {
          verdict: parsed.verdict as AnalysisResult["verdict"],
          confidence: Math.round(parsed.confidence as number),
          headline: (parsed.headline as string).slice(0, 120),
          summary: (parsed.summary as string).slice(0, 600),
          category: (parsed.category as AnalysisResult["category"]) || claim.category,
          reasoning: Array.isArray(parsed.reasoning)
            ? (parsed.reasoning as ReasoningStep[]).slice(0, 6)
            : [],
          sources: allSources,
          evidenceBreakdown: {
            supporting: evidence.supporting.length > 0
              ? Math.round((evidence.supporting.length / (evidence.supporting.length + evidence.opposing.length || 1)) * 100)
              : 50,
            opposing: evidence.opposing.length > 0
              ? Math.round((evidence.opposing.length / (evidence.supporting.length + evidence.opposing.length || 1)) * 100)
              : 50,
            consensus: 60,
            quality: 70,
          },
          radar: {
            accuracy: Math.min(100, (parsed.confidence as number) || 60),
            diversity: Math.min(100, new Set(allSources.map((s) => s.domain)).size * 20),
            consensus: 60,
            recency: 70,
            verifiability: evidence.factChecks.length > 0 ? 85 : 55,
          },
          warnings: Array.isArray(parsed.warnings)
            ? (parsed.warnings as string[]).slice(0, 3)
            : [],
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[Claude] Attempt ${attempt} failed:`, lastError.message);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    // All Claude attempts failed — fall back to rules engine
    console.warn("[Claude] All attempts failed, using rules fallback");
    return rulesSynthesisProvider.synthesize(claim, evidence);
  }
}

export const claudeSynthesisProvider = new ClaudeSynthesisProvider();
