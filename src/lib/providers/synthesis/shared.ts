import type {
  NormalizedClaim,
  EvidenceBundle,
  ReasoningStep,
  AnalysisResult,
} from "@/types";

export const SYNTHESIS_SYSTEM_PROMPT = `You are TruthLens, an expert fact-checking AI. Your job is to synthesize pre-retrieved evidence into a structured verdict.

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

export function buildSynthesisPrompt(
  claim: NormalizedClaim,
  evidence: EvidenceBundle
): string {
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

export function safeParseJson(text: string): Record<string, unknown> | null {
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
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

export function validateSynthesisResult(obj: Record<string, unknown>): boolean {
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

export function coerceReasoning(reasoning: unknown): ReasoningStep[] {
  if (!Array.isArray(reasoning)) return [];
  return reasoning
    .filter((item): item is ReasoningStep => {
      if (!item || typeof item !== "object") return false;
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.step === "string" &&
        typeof obj.icon === "string" &&
        typeof obj.color === "string" &&
        typeof obj.text === "string"
      );
    })
    .slice(0, 6);
}

export function fallbackSynthesisShape(claim: NormalizedClaim, evidence: EvidenceBundle) {
  return {
    verdict: claim.isCheckable ? (evidence.hasConflict ? ("MIXED" as const) : "UNVERIFIED" as const) : ("UNVERIFIED" as const),
    confidence: claim.isCheckable ? (evidence.evidenceStrength === "strong" ? 68 : evidence.evidenceStrength === "moderate" ? 56 : 42) : 30,
    headline: claim.isCheckable ? "Evidence remains incomplete." : "This claim is not straightforward to verify.",
    summary: claim.isCheckable
      ? "TruthLens found public evidence, but not enough consensus for a hard verdict. The safest reading is to treat this claim cautiously until stronger primary sources appear."
      : "The claim is interpretive, opinion-based, or otherwise hard to verify as a factual statement.",
    category: claim.category,
    reasoning: [
      {
        step: "Synthesis fallback",
        icon: "🧩",
        color: "#F4B961",
        text: "The AI router fell back to the deterministic rules engine to keep the analysis available and avoid hard errors.",
      },
    ] as ReasoningStep[],
    warnings: ["Live AI synthesis was unavailable, so a conservative rules-based answer was returned."],
  };
}

export function normalizeJsonSummary(obj: Record<string, unknown>, claim: NormalizedClaim, evidence: EvidenceBundle) {
  const allSources = [
    ...evidence.supporting,
    ...evidence.opposing,
    ...evidence.neutral,
  ].slice(0, 8);

  return {
    verdict: (obj.verdict as AnalysisResult["verdict"]) || "UNVERIFIED",
    confidence: Math.max(0, Math.min(100, Math.round((obj.confidence as number) || 0))),
    headline: String(obj.headline || claim.normalized || "TruthLens analysis").slice(0, 120),
    summary: String(obj.summary || "").slice(0, 600),
    category: (obj.category as AnalysisResult["category"]) || claim.category,
    reasoning: coerceReasoning(obj.reasoning),
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
      accuracy: Math.min(100, Math.max(0, Number(obj.confidence) || 60)),
      diversity: Math.min(100, new Set(allSources.map((s) => s.domain)).size * 20),
      consensus: 60,
      recency: 70,
      verifiability: evidence.factChecks.length > 0 ? 85 : 55,
    },
    warnings: Array.isArray(obj.warnings) ? (obj.warnings as string[]).slice(0, 3) : [],
  };
}
