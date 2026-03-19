// OpenRouter synthesis provider — free-router first.
import type {
  NormalizedClaim,
  EvidenceBundle,
  AnalysisResult,
  SynthesisProvider,
} from "@/types";
import { buildSynthesisPrompt, normalizeJsonSummary, safeParseJson, validateSynthesisResult, SYNTHESIS_SYSTEM_PROMPT } from "./shared";
import { rulesSynthesisProvider } from "./rules";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

class OpenRouterSynthesisProvider implements SynthesisProvider {
  name = "openrouter";

  isAvailable(): boolean {
    return !!(process.env.OPENROUTER_API_KEY && process.env.ENABLE_AI_SYNTHESIS === "true");
  }

  async synthesize(
    claim: NormalizedClaim,
    evidence: EvidenceBundle
  ): Promise<Omit<AnalysisResult, "cacheStatus" | "latencyMs" | "synthesisMode">> {
    const key = process.env.OPENROUTER_API_KEY!;
    const model = process.env.OPENROUTER_MODEL || "openrouter/free";
    const prompt = buildSynthesisPrompt(claim, evidence);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "TruthLens",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.15,
          top_p: 0.9,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        throw new Error(`OpenRouter error: ${res.status}`);
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content || "";
      const parsed = safeParseJson(text);
      if (!parsed || !validateSynthesisResult(parsed)) {
        throw new Error("OpenRouter returned invalid JSON");
      }

      return normalizeJsonSummary(parsed, claim, evidence);
    } catch (err) {
      console.warn("[OpenRouter] synthesis failed; using rules fallback", err);
      if (process.env.OPENROUTER_FALLBACK_TO_RULES === "false") {
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
            text: "OpenRouter free inference was unavailable or returned malformed output, so TruthLens fell back to the rules engine.",
          },
        ],
      };
    }
  }
}

export const openrouterSynthesisProvider = new OpenRouterSynthesisProvider();
