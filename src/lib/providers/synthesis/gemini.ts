// Gemini synthesis provider — free tier fallback.
import type {
  NormalizedClaim,
  EvidenceBundle,
  AnalysisResult,
  SynthesisProvider,
} from "@/types";
import { buildSynthesisPrompt, normalizeJsonSummary, safeParseJson, validateSynthesisResult, SYNTHESIS_SYSTEM_PROMPT } from "./shared";
import { rulesSynthesisProvider } from "./rules";

const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

class GeminiSynthesisProvider implements SynthesisProvider {
  name = "gemini";

  isAvailable(): boolean {
    return !!(process.env.GEMINI_API_KEY && process.env.ENABLE_AI_SYNTHESIS === "true");
  }

  async synthesize(
    claim: NormalizedClaim,
    evidence: EvidenceBundle
  ): Promise<Omit<AnalysisResult, "cacheStatus" | "latencyMs" | "synthesisMode">> {
    const key = process.env.GEMINI_API_KEY!;
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const prompt = buildSynthesisPrompt(claim, evidence);

    try {
      const url = `${GEMINI_URL_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYNTHESIS_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            topP: 0.9,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        throw new Error(`Gemini error: ${res.status}`);
      }

      const data = await res.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      const parsed = safeParseJson(text);
      if (!parsed || !validateSynthesisResult(parsed)) {
        throw new Error("Gemini returned invalid JSON");
      }

      return normalizeJsonSummary(parsed, claim, evidence);
    } catch (err) {
      console.warn("[Gemini] synthesis failed; using rules fallback", err);
      if (process.env.GEMINI_FALLBACK_TO_RULES === "false") {
        throw err instanceof Error ? err : new Error(String(err));
      }
      const fallback = await rulesSynthesisProvider.synthesize(claim, evidence);
      return {
        ...fallback,
        reasoning: [
          ...fallback.reasoning,
          {
            step: "AI fallback",
            icon: "↺",
            color: "#6B8AFD",
            text: "Gemini free-tier inference was unavailable or returned malformed output, so TruthLens fell back to the rules engine.",
          },
        ],
      };
    }
  }
}

export const geminiSynthesisProvider = new GeminiSynthesisProvider();
