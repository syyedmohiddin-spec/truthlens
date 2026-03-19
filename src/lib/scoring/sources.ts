// src/lib/scoring/sources.ts
// Pure functions for scoring and classifying retrieved sources.
// No external calls — all deterministic from the data passed in.

import type { RawSource, ScoredSource, SourceStance } from "@/types";

// ── DOMAIN TRUST SCORES ────────────────────────────────────────────────────────
// Manually curated credibility tiers (1-5).
// Extensible — add domains as needed.
const DOMAIN_CREDIBILITY: Record<string, number> = {
  // Tier 5 — Highest credibility
  "nature.com": 5,
  "science.org": 5,
  "cell.com": 5,
  "nejm.org": 5,
  "thelancet.com": 5,
  "bmj.com": 5,
  "who.int": 5,
  "cdc.gov": 5,
  "nih.gov": 5,
  "nasa.gov": 5,
  "ncbi.nlm.nih.gov": 5,
  "pubmed.ncbi.nlm.nih.gov": 5,
  "gov.uk": 5,
  "europa.eu": 5,
  "un.org": 5,

  // Tier 4 — High credibility
  "reuters.com": 4,
  "apnews.com": 4,
  "bbc.com": 4,
  "bbc.co.uk": 4,
  "theguardian.com": 4,
  "nytimes.com": 4,
  "washingtonpost.com": 4,
  "wsj.com": 4,
  "economist.com": 4,
  "ft.com": 4,
  "npr.org": 4,
  "pbs.org": 4,
  "thehindu.com": 4,
  "timesofindia.indiatimes.com": 4,
  "ndtv.com": 4,
  "factcheck.org": 5,
  "snopes.com": 4,
  "politifact.com": 4,
  "fullfact.org": 4,
  "boomlive.in": 4,
  "altnews.in": 4,
  "wikipedia.org": 4,
  "britannica.com": 4,

  // Tier 3 — Moderate credibility
  "medium.com": 3,
  "forbes.com": 3,
  "cnbc.com": 3,
  "cnn.com": 3,
  "cbsnews.com": 3,
  "nbcnews.com": 3,
  "abcnews.go.com": 3,
  "vox.com": 3,
  "theatlantic.com": 3,

  // Tier 2 — Lower credibility (not automatically excluded)
  "dailymail.co.uk": 2,
  "foxnews.com": 2,
  "nypost.com": 2,

  // Tier 1 — Low credibility
  "infowars.com": 1,
  "naturalews.com": 1,
};

const DEFAULT_DOMAIN_CREDIBILITY = 3;

export function getDomainCredibility(domain: string): number {
  return DOMAIN_CREDIBILITY[domain.toLowerCase()] ?? DEFAULT_DOMAIN_CREDIBILITY;
}

// ── RECENCY SCORING ───────────────────────────────────────────────────────────
export function scoreRecency(publishedAt?: string): number {
  if (!publishedAt) return 50; // Unknown date → neutral

  try {
    const pub = new Date(publishedAt);
    const ageMs = Date.now() - pub.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < 1) return 100;
    if (ageDays < 7) return 95;
    if (ageDays < 30) return 85;
    if (ageDays < 90) return 75;
    if (ageDays < 365) return 60;
    if (ageDays < 365 * 3) return 45;
    return 30;
  } catch {
    return 50;
  }
}

// ── RELEVANCE SCORING ─────────────────────────────────────────────────────────
// Simple keyword overlap scoring. Good enough for MVP.
// In production, replace with embedding-based cosine similarity.
export function scoreRelevance(
  snippet: string,
  title: string,
  claim: string
): number {
  const claimWords = new Set(
    claim
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const textWords = (snippet + " " + title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (claimWords.size === 0 || textWords.length === 0) return 50;

  const matchCount = textWords.filter((w) => claimWords.has(w)).length;
  const overlap = matchCount / claimWords.size;

  return Math.min(100, Math.round(overlap * 120)); // cap at 100
}

// ── STANCE DETECTION ──────────────────────────────────────────────────────────
// Keyword-based stance detection. Conservative defaults.
export function detectStance(
  snippet: string,
  title: string,
  claim: string
): SourceStance {
  const text = (snippet + " " + title).toLowerCase();
  const claimLower = claim.toLowerCase().slice(0, 100);

  // Explicit false signals
  const falsyKeywords = [
    "false", "debunked", "misleading", "misinformation", "disproven",
    "untrue", "wrong", "incorrect", "no evidence", "myth", "hoax",
    "fake news", "not true", "contradicts", "contradicted", "denies",
    "refutes", "refuted", "disputed", "inaccurate",
  ];
  const falsyCount = falsyKeywords.filter((k) => text.includes(k)).length;

  // Explicit true signals
  const truthyKeywords = [
    "confirmed", "true", "accurate", "correct", "verified", "fact",
    "real", "genuine", "legitimate", "supports", "evidence shows",
    "studies show", "research confirms", "data confirms", "proven",
  ];
  const truthyCount = truthyKeywords.filter((k) => text.includes(k)).length;

  if (falsyCount >= 2 || (falsyCount > 0 && truthyCount === 0)) return "opposes";
  if (truthyCount >= 2 || (truthyCount > 0 && falsyCount === 0)) return "supports";
  return "neutral";
}

// ── MAIN SCORER ───────────────────────────────────────────────────────────────
export function scoreSource(source: RawSource, claim: string): ScoredSource {
  return {
    title: source.title,
    url: source.url,
    domain: source.domain,
    snippet: source.snippet.slice(0, 500), // Hard limit
    stance: detectStance(source.snippet, source.title, claim),
    credibility: getDomainCredibility(source.domain),
    sourceType: source.sourceType,
    recencyScore: scoreRecency(source.publishedAt),
    relevanceScore: scoreRelevance(source.snippet, source.title, claim),
    publishedAt: source.publishedAt,
  };
}

export function scoreSources(sources: RawSource[], claim: string): ScoredSource[] {
  return sources
    .map((s) => scoreSource(s, claim))
    .filter((s) => s.url && s.title) // Filter empty results
    .sort((a, b) => {
      // Sort by composite score: credibility * relevance
      const scoreA = a.credibility * 20 + a.relevanceScore * 0.8;
      const scoreB = b.credibility * 20 + b.relevanceScore * 0.8;
      return scoreB - scoreA;
    })
    .slice(0, 8); // Top 8 sources
}

// ── DEDUPLICATION ─────────────────────────────────────────────────────────────
export function deduplicateSources(sources: RawSource[]): RawSource[] {
  const seenUrls = new Set<string>();
  const domainCounts = new Map<string, number>();

  return sources.filter((s) => {
    const url = s.url.toLowerCase().replace(/\?.*$/, "").replace(/#.*$/, "").trim();
    if (!url) return false;

    let domainKey = (s.domain || "").toLowerCase().trim();
    if (!domainKey) {
      try {
        domainKey = new URL(s.url).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        domainKey = "unknown";
      }
    }

    if (seenUrls.has(url)) return false;

    const currentCount = domainCounts.get(domainKey) || 0;
    if (currentCount >= 2) return false;

    seenUrls.add(url);
    domainCounts.set(domainKey, currentCount + 1);
    return true;
  });
}
