// src/lib/normalize/claim.ts
// Normalization layer: clean input, classify intent, extract search queries.
// Pure functions — no side effects, fully testable.

import crypto from "crypto";
import type {
  NormalizedClaim,
  ClaimCategory,
  ClaimIntent,
} from "@/types";

const MAX_CLAIM_LENGTH = 600;
const MIN_CLAIM_LENGTH = 10;

// ── SANITIZATION ──────────────────────────────────────────────────────────────
export function sanitizeClaim(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .replace(/<[^>]*>/g, " ")                             // strip HTML tags
    .replace(/&[a-z]+;/gi, " ")                           // strip HTML entities
    .replace(/\s+/g, " ")                                 // collapse whitespace
    .trim()
    .slice(0, MAX_CLAIM_LENGTH);
}

export function validateClaim(
  raw: string
): { valid: true } | { valid: false; reason: string } {
  const cleaned = sanitizeClaim(raw);
  if (cleaned.length < MIN_CLAIM_LENGTH) {
    return { valid: false, reason: "Claim is too short to analyze." };
  }
  if (cleaned.length > MAX_CLAIM_LENGTH) {
    return {
      valid: false,
      reason: `Claim exceeds maximum length of ${MAX_CLAIM_LENGTH} characters.`,
    };
  }
  // Reject claims that are just a URL with no surrounding text
  const urlOnly = /^https?:\/\/\S+$/.test(cleaned);
  if (urlOnly) {
    return {
      valid: false,
      reason:
        "Please paste the claim text, not just a URL. You can include the URL within the claim text.",
    };
  }
  return { valid: true };
}

// ── NORMALIZATION ─────────────────────────────────────────────────────────────
export function normalizeClaim(raw: string): string {
  return sanitizeClaim(raw)
    .toLowerCase()
    .replace(/['']/g, "'")   // normalize quotes
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")   // normalize dashes
    .replace(/\s+/g, " ")
    .trim();
}

// ── HASHING ───────────────────────────────────────────────────────────────────
export function hashClaim(normalized: string): string {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// ── INTENT CLASSIFICATION ─────────────────────────────────────────────────────
export function classifyIntent(claim: string): ClaimIntent {
  const text = claim.toLowerCase();

  const satiricalKeywords = [
    "onion", "babylon bee", "satirical", "parody", "satire", "joke"
  ];
  if (satiricalKeywords.some((k) => text.includes(k))) return "satire";

  const opinionKeywords = [
    "i think", "i believe", "in my opinion", "personally", "it seems to me",
    "one should", "we should", "the best", "the worst", "better than",
  ];
  if (opinionKeywords.some((k) => text.includes(k))) return "opinion";

  const statisticalPatterns = /\d+(\.\d+)?%|\d[\d,]+\s*(people|cases|deaths|km|miles|years)/i;
  if (statisticalPatterns.test(claim)) return "statistical";

  const causalKeywords = ["causes", "leads to", "results in", "due to", "because of", "linked to"];
  if (causalKeywords.some((k) => text.includes(k))) return "causal";

  const predictiveKeywords = ["will", "going to", "predicted to", "expected to", "forecast"];
  if (predictiveKeywords.some((k) => text.includes(k))) return "predictive";

  const definitionalKeywords = ["means", "is defined as", "refers to", "stands for"];
  if (definitionalKeywords.some((k) => text.includes(k))) return "definitional";

  return "factual";
}

// ── CATEGORY CLASSIFICATION ───────────────────────────────────────────────────
export function classifyCategory(claim: string): ClaimCategory {
  const text = claim.toLowerCase();

  const categoryRules: Array<[ClaimCategory, string[]]> = [
    ["health", ["vaccine", "cancer", "disease", "covid", "drug", "medication", "health", "virus", "cure", "medical", "diabetes", "heart"]],
    ["scientific", ["study", "research", "scientist", "nasa", "climate", "evolution", "planet", "species", "physics", "quantum", "dna", "gene"]],
    ["political", ["president", "prime minister", "election", "vote", "congress", "parliament", "government", "policy", "democrat", "republican", "party", "senate", "modi", "trump", "biden"]],
    ["financial", ["stock", "market", "economy", "gdp", "inflation", "bank", "crypto", "bitcoin", "investment", "revenue", "profit", "billion", "million dollar"]],
    ["historical", ["world war", "history", "century", "ancient", "founded", "invented", "discovered", "year ago", "decade ago"]],
    ["geographical", ["country", "city", "continent", "ocean", "mountain", "river", "population", "capital", "miles", "km from"]],
    ["legal", ["law", "legal", "court", "judge", "convicted", "arrested", "lawsuit", "illegal", "banned"]],
    ["cultural", ["film", "movie", "music", "celebrity", "actor", "singer", "book", "author", "game", "sport"]],
  ];

  for (const [category, keywords] of categoryRules) {
    if (keywords.some((k) => text.includes(k))) return category;
  }

  return "other";
}

// ── SEARCH QUERY GENERATION ───────────────────────────────────────────────────
export function generateSearchQueries(claim: string, category: ClaimCategory): string[] {
  const queries: string[] = [];

  // Primary: the claim itself (truncated)
  const truncated = claim.slice(0, 120);
  queries.push(truncated);

  // Fact-check targeted query
  queries.push(`fact check: ${truncated.slice(0, 80)}`);

  // Category-specific additions
  const categoryBoosts: Partial<Record<ClaimCategory, string>> = {
    health: "scientific study evidence",
    scientific: "peer reviewed research",
    political: "verified report",
    financial: "official data",
    historical: "historical record",
  };
  const boost = categoryBoosts[category];
  if (boost) {
    queries.push(`${truncated.slice(0, 80)} ${boost}`);
  }

  return [...new Set(queries)]; // deduplicate
}

export function generateWikiQuery(claim: string, category: ClaimCategory): string {
  // Extract the most important 3-4 words for Wikipedia lookup
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "shall", "can", "that", "this", "these", "those",
    "i", "we", "you", "he", "she", "it", "they", "not", "no", "and", "or",
    "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  ]);

  const words = claim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 4);

  return words.join(" ") || claim.slice(0, 40);
}

// ── CHECKABILITY ──────────────────────────────────────────────────────────────
export function isCheckable(intent: ClaimIntent): boolean {
  return intent !== "opinion" && intent !== "satire";
}

export function needsClarification(claim: string): {
  needed: boolean;
  hint?: string;
} {
  const text = claim.toLowerCase();

  if (text.length < 20) {
    return { needed: true, hint: "Could you provide more context for this claim?" };
  }

  const vagueTerms = ["this", "that", "it", "they", "someone"];
  const hasVague = vagueTerms.some((t) => new RegExp(`\\b${t}\\b`).test(text));
  const noProperNouns = !/[A-Z]/.test(claim);

  if (hasVague && noProperNouns && claim.split(" ").length < 8) {
    return {
      needed: true,
      hint:
        "The claim seems vague. Who or what are you referring to specifically?",
    };
  }

  return { needed: false };
}

// ── KEY ENTITY EXTRACTION ─────────────────────────────────────────────────────
export function extractKeyEntities(claim: string): string[] {
  // Extract capitalized phrases and quoted strings as key entities
  const entities: string[] = [];

  // Capitalized words (potential proper nouns)
  const capitalizedMatches = claim.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) || [];
  entities.push(...capitalizedMatches);

  // Quoted strings
  const quotedMatches = claim.match(/"([^"]+)"|'([^']+)'/g) || [];
  entities.push(...quotedMatches.map((q) => q.replace(/['"]/g, "")));

  return [...new Set(entities)].slice(0, 6);
}

// ── MAIN NORMALIZER ───────────────────────────────────────────────────────────
export function normalizeClaim_full(raw: string): NormalizedClaim {
  const normalized = normalizeClaim(raw);
  const hash = hashClaim(normalized);
  const intent = classifyIntent(raw);
  const category = classifyCategory(raw);
  const checkable = isCheckable(intent);
  const { needed: clarificationNeeded, hint: clarificationHint } =
    needsClarification(raw);

  return {
    original: raw,
    normalized,
    hash,
    intent,
    category,
    isCheckable: checkable,
    clarificationNeeded,
    clarificationHint,
    keyEntities: extractKeyEntities(raw),
    searchQueries: checkable ? generateSearchQueries(raw, category) : [],
    wikiQuery: generateWikiQuery(raw, category),
  };
}
