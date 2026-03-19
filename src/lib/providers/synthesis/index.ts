import { claudeSynthesisProvider } from "./claude";
import { geminiSynthesisProvider } from "./gemini";
import { openrouterSynthesisProvider } from "./openrouter";

export const synthesisProviders = [
  openrouterSynthesisProvider,
  geminiSynthesisProvider,
  claudeSynthesisProvider,
];

export function getAvailableSynthesisProviders() {
  return synthesisProviders.filter((provider) => provider.isAvailable());
}
