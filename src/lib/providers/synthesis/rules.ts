// src/lib/providers/synthesis/rules.ts
// Deterministic rules-based synthesis.
// Used when AI synthesis is disabled, budget is exhausted, or AI fails.
// Produces a real, honest verdict from evidence without any model calls.

import type {
  NormalizedClaim,
  EvidenceBundle,
  AnalysisResult,
  Verdict,
  ReasoningStep,
  EvidenceBreakdown,
  RadarScores,
  SynthesisProvider,
} from "@/types";

// ── VERDICT DERIVATION ────────────────────────────────────────────────────────
function deriveVerdict(
  evidence: EvidenceBundle,
  claim: {
    isCheckable: boolean;
    intent: string;
  }
): { verdict: Verdict; confidence: number; warnings: string[] } {
  const warnings: string[] = [];

  if (!claim.isCheckable) {
    return {
      verdict: "UNVERIFIED",
      confidence: 0,
      warnings: [
        claim.intent === "opinion"
          ? "This appears to be an opinion, which cannot be fact-checked."
          : "This appears to be satire or parody.",
      ],
    };
  }

  const { supporting, opposing, neutral, factChecks } = evidence;

  // If we have professional fact-checks, weight them heavily
  if (factChecks.length > 0) {
    const falseChecks = factChecks.filter((fc) =>
      /false|misleading|incorrect|misinformation|debunked/i.test(fc.rating)
    );
    const trueChecks = factChecks.filter((fc) =>
      /true|accurate|correct|verified/i.test(fc.rating)
    );

    if (falseChecks.length > trueChecks.length) {
      warnings.push(
        `${falseChecks.length} professional fact-checker(s) have rated this claim as false or misleading.`
      );
      return {
        verdict: "FALSE",
        confidence: Math.min(90, 60 + falseChecks.length * 10),
        warnings,
      };
    }
    if (trueChecks.length > 0 && falseChecks.length === 0) {
      return {
        verdict: "TRUE",
        confidence: Math.min(85, 55 + trueChecks.length * 10),
        warnings,
      };
    }
  }

  const totalSources = supporting.length + opposing.length;
  if (totalSources === 0) {
    warnings.push("Insufficient web sources were found to verify this claim.");
    if (evidence.wikiContext) {
      warnings.push("Only encyclopedic context was available.");
    }
    return { verdict: "UNVERIFIED", confidence: 20, warnings };
  }

  const supportRatio = supporting.length / totalSources;
  const avgSupportCredibility =
    supporting.length > 0
      ? supporting.reduce((s, x) => s + x.credibility, 0) / supporting.length
      : 0;
  const avgOpposeCredibility =
    opposing.length > 0
      ? opposing.reduce((s, x) => s + x.credibility, 0) / opposing.length
      : 0;

  // Credibility-weighted ratio
  const weightedSupport = supporting.reduce(
    (s, x) => s + x.credibility * x.relevanceScore,
    0
  );
  const weightedOppose = opposing.reduce(
    (s, x) => s + x.credibility * x.relevanceScore,
    0
  );
  const total = weightedSupport + weightedOppose;
  const credWeightedRatio = total > 0 ? weightedSupport / total : 0.5;

  if (evidence.hasConflict) {
    warnings.push(
      "Sources conflict on this claim. Multiple perspectives exist."
    );
  }

  // Low evidence strength → be conservative
  if (evidence.evidenceStrength === "weak") {
    warnings.push(
      "Evidence for this claim is limited. Treat this verdict with caution."
    );
  }

  if (credWeightedRatio >= 0.78) {
    return {
      verdict: "TRUE",
      confidence: Math.round(50 + credWeightedRatio * 40),
      warnings,
    };
  }
  if (credWeightedRatio <= 0.22) {
    return {
      verdict: "FALSE",
      confidence: Math.round(50 + (1 - credWeightedRatio) * 40),
      warnings,
    };
  }
  if (credWeightedRatio >= 0.45 && credWeightedRatio <= 0.65) {
    return {
      verdict: "MIXED",
      confidence: Math.round(40 + totalSources * 5),
      warnings,
    };
  }

  return {
    verdict: "UNVERIFIED",
    confidence: 25,
    warnings: ["Evidence is inconclusive.", ...warnings],
  };
}

// ── EVIDENCE BREAKDOWN ────────────────────────────────────────────────────────
function buildEvidenceBreakdown(evidence: EvidenceBundle): EvidenceBreakdown {
  const total = evidence.supporting.length + evidence.opposing.length;
  const supportPct = total > 0
    ? Math.round((evidence.supporting.length / total) * 100)
    : 50;
  const opposePct = total > 0 ? 100 - supportPct : 50;

  const allSources = [...evidence.supporting, ...evidence.opposing, ...evidence.neutral];
  const avgCredibility = allSources.length > 0
    ? allSources.reduce((s, x) => s + x.credibility, 0) / allSources.length
    : 3;
  const qualityPct = Math.round((avgCredibility / 5) * 100);

  // Consensus: how aligned are sources?
  const conflictPenalty = evidence.hasConflict ? 20 : 0;
  const consensusPct = Math.max(0, 100 - Math.abs(supportPct - 50) * 0.5 - conflictPenalty);

  return {
    supporting: supportPct,
    opposing: opposePct,
    consensus: Math.round(consensusPct),
    quality: qualityPct,
  };
}

// ── RADAR SCORES ──────────────────────────────────────────────────────────────
function buildRadarScores(evidence: EvidenceBundle): RadarScores {
  const allSources = [
    ...evidence.supporting,
    ...evidence.opposing,
    ...evidence.neutral,
  ];

  const avgCredibility =
    allSources.length > 0
      ? allSources.reduce((s, x) => s + x.credibility, 0) / allSources.length
      : 3;

  const avgRecency =
    allSources.length > 0
      ? allSources.reduce((s, x) => s + x.recencyScore, 0) / allSources.length
      : 50;

  const avgRelevance =
    allSources.length > 0
      ? allSources.reduce((s, x) => s + x.relevanceScore, 0) / allSources.length
      : 50;

  // Domain diversity: how many unique domains?
  const uniqueDomains = new Set(allSources.map((s) => s.domain)).size;
  const diversityPct = Math.min(100, uniqueDomains * 20);

  // Verifiability: fact-check coverage
  const verifiabilityPct =
    evidence.factChecks.length > 0
      ? Math.min(100, 50 + evidence.factChecks.length * 15)
      : allSources.length > 0
      ? Math.round((avgCredibility / 5) * 70)
      : 20;

  return {
    accuracy: Math.round((avgCredibility / 5) * 100),
    diversity: Math.round(diversityPct),
    consensus: buildEvidenceBreakdown(evidence).consensus,
    recency: Math.round(avgRecency),
    verifiability: verifiabilityPct,
  };
}

// ── REASONING CHAIN ───────────────────────────────────────────────────────────
function buildReasoning(
  claim: NormalizedClaim,
  evidence: EvidenceBundle,
  verdict: Verdict,
  confidence: number
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  // Step 1: Claim classification
  steps.push({
    step: "Claim Analysis",
    icon: "🔬",
    color: "#00e87a",
    text: `Identified as a ${claim.category} claim with ${claim.intent} intent. ${
      claim.isCheckable
        ? "This claim makes a verifiable assertion."
        : "This claim does not make a verifiable factual assertion."
    }`,
  });

  // Step 2: Retrieval summary
  const totalSources =
    evidence.supporting.length +
    evidence.opposing.length +
    evidence.neutral.length;
  steps.push({
    step: "Source Retrieval",
    icon: "🌐",
    color: "#00d4ff",
    text:
      totalSources > 0
        ? `Retrieved ${totalSources} sources: ${evidence.supporting.length} supporting, ${evidence.opposing.length} opposing, ${evidence.neutral.length} neutral.${
            evidence.factChecks.length > 0
              ? ` Found ${evidence.factChecks.length} professional fact-check(s).`
              : ""
          }`
        : "No relevant web sources were found for this claim.",
  });

  // Step 3: Evidence assessment
  steps.push({
    step: "Evidence Assessment",
    icon: evidence.supporting.length > evidence.opposing.length ? "✅" : "❌",
    color:
      evidence.supporting.length > evidence.opposing.length
        ? "#00e87a"
        : "#f43f5e",
    text: buildEvidenceSummary(evidence),
  });

  // Step 4: Conflict detection
  if (evidence.hasConflict) {
    steps.push({
      step: "Conflict Detected",
      icon: "⚠️",
      color: "#f59e0b",
      text: `Sources are in conflict. Supporting sources average credibility: ${
        evidence.supporting.length > 0
          ? (
              evidence.supporting.reduce((s, x) => s + x.credibility, 0) /
              evidence.supporting.length
            ).toFixed(1)
          : "N/A"
      }/5. Opposing sources average: ${
        evidence.opposing.length > 0
          ? (
              evidence.opposing.reduce((s, x) => s + x.credibility, 0) /
              evidence.opposing.length
            ).toFixed(1)
          : "N/A"
      }/5.`,
    });
  }

  // Step 5: Verdict synthesis
  steps.push({
    step: "Verdict Synthesis",
    icon: "⚖️",
    color: "#a855f7",
    text: buildVerdictRationale(verdict, confidence, evidence),
  });

  return steps;
}

function buildEvidenceSummary(evidence: EvidenceBundle): string {
  if (evidence.supporting.length === 0 && evidence.opposing.length === 0) {
    return "No direct supporting or opposing evidence was found in retrieved sources.";
  }

  const topSupporting = evidence.supporting[0];
  const topOpposing = evidence.opposing[0];
  let text = "";

  if (topSupporting) {
    text += `Key supporting source: ${topSupporting.domain} (credibility ${topSupporting.credibility}/5). `;
  }
  if (topOpposing) {
    text += `Key opposing source: ${topOpposing.domain} (credibility ${topOpposing.credibility}/5). `;
  }

  if (evidence.factChecks.length > 0) {
    const fc = evidence.factChecks[0];
    text += `${fc.publisher} rated this: "${fc.rating}".`;
  }

  return text.trim() || "Evidence is mixed across retrieved sources.";
}

function buildVerdictRationale(
  verdict: Verdict,
  confidence: number,
  evidence: EvidenceBundle
): string {
  const totalSources =
    evidence.supporting.length +
    evidence.opposing.length +
    evidence.neutral.length;
  const certText =
    confidence >= 80
      ? "Strong evidence"
      : confidence >= 60
      ? "Moderate evidence"
      : confidence >= 40
      ? "Limited evidence"
      : "Insufficient evidence";

  switch (verdict) {
    case "TRUE":
      return `${certText} supports this claim. ${totalSources} sources reviewed, with credible sources predominantly in agreement.`;
    case "FALSE":
      return `${certText} contradicts this claim. ${totalSources} sources reviewed, with credible sources predominantly refuting it.`;
    case "MIXED":
      return `Evidence is divided. ${totalSources} sources reviewed with significant disagreement. The claim may be partially true, oversimplified, or context-dependent.`;
    case "UNVERIFIED":
      return `Insufficient verifiable evidence was found. ${totalSources} sources reviewed without a clear consensus. This claim cannot be confirmed or denied with available data.`;
  }
}

// ── HEADLINE GENERATION ───────────────────────────────────────────────────────
function generateHeadline(
  verdict: Verdict,
  claim: NormalizedClaim,
  confidence: number
): string {
  const certifier =
    confidence >= 80 ? "Confirmed" : confidence >= 60 ? "Likely" : "Possibly";
  switch (verdict) {
    case "TRUE":
      return `${certifier} true — evidence supports this claim`;
    case "FALSE":
      return `${certifier} false — evidence contradicts this claim`;
    case "MIXED":
      return "Partly true — claim is oversimplified or context-dependent";
    case "UNVERIFIED":
      return claim.isCheckable
        ? "Cannot verify — insufficient evidence found"
        : claim.intent === "opinion"
        ? "This is an opinion, not a verifiable fact"
        : "This appears to be satire or parody";
  }
}

function generateSummary(
  verdict: Verdict,
  evidence: EvidenceBundle,
  claim: NormalizedClaim,
  warnings: string[]
): string {
  const baseLines: string[] = [];

  if (evidence.factChecks.length > 0) {
    const fc = evidence.factChecks[0];
    baseLines.push(
      `${fc.publisher} has reviewed this claim and rated it: "${fc.rating}".`
    );
  }

  const totalSources =
    evidence.supporting.length +
    evidence.opposing.length +
    evidence.neutral.length;

  if (totalSources > 0) {
    baseLines.push(
      `Analysis of ${totalSources} sources found ${evidence.supporting.length} in support and ${evidence.opposing.length} in opposition.`
    );
  }

  if (evidence.wikiContext) {
    baseLines.push(
      `Encyclopedic context from Wikipedia: "${evidence.wikiContext.extract.slice(0, 150)}..."`
    );
  }

  if (warnings.length > 0) {
    baseLines.push(warnings[0]);
  }

  return baseLines.slice(0, 3).join(" ") || "No conclusive evidence was found.";
}

// ── RULES SYNTHESIS PROVIDER ──────────────────────────────────────────────────
class RulesSynthesisProvider implements SynthesisProvider {
  name = "rules-engine";

  isAvailable(): boolean {
    return true; // Always available
  }

  async synthesize(
    claim: NormalizedClaim,
    evidence: EvidenceBundle
  ): Promise<Omit<AnalysisResult, "cacheStatus" | "latencyMs" | "synthesisMode">> {
    const { verdict, confidence, warnings } = deriveVerdict(evidence, claim);
    const evidenceBreakdown = buildEvidenceBreakdown(evidence);
    const radar = buildRadarScores(evidence);
    const reasoning = buildReasoning(claim, evidence, verdict, confidence);
    const headline = generateHeadline(verdict, claim, confidence);
    const summary = generateSummary(verdict, evidence, claim, warnings);

    return {
      verdict,
      confidence,
      headline,
      summary,
      category: claim.category,
      reasoning,
      sources: [
        ...evidence.supporting,
        ...evidence.opposing,
        ...evidence.neutral,
      ].slice(0, 8),
      evidenceBreakdown,
      radar,
      warnings,
    };
  }
}

export const rulesSynthesisProvider = new RulesSynthesisProvider();
