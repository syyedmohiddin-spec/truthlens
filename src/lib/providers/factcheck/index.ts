// src/lib/providers/factcheck/index.ts
// FactCheckProvider: queries Google Fact Check Tools API.
// Free tier, no per-query cost. Requires a Google API key.
// Falls back to empty array gracefully if unavailable.

import type { FactCheckProvider, FactCheckResult } from "@/types";
import { getCache, CacheKeys } from "@/lib/cache";

class GoogleFactCheckProvider implements FactCheckProvider {
  name = "google-factcheck";

  isAvailable(): boolean {
    return !!process.env.GOOGLE_FACT_CHECK_API_KEY;
  }

  async query(claim: string): Promise<FactCheckResult[]> {
    const key = process.env.GOOGLE_FACT_CHECK_API_KEY!;

    const cache = await getCache();
    // Use first 80 chars as cache key — enough uniqueness
    const truncated = claim.slice(0, 80).toLowerCase().trim();
    const cacheKey = `tl:fc:${Buffer.from(truncated).toString("base64url").slice(0, 24)}`;

    const cached = await cache.get<FactCheckResult[]>(cacheKey);
    if (cached) return cached;

    const url = new URL(
      "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    );
    url.searchParams.set("query", claim.slice(0, 200));
    url.searchParams.set("key", key);
    url.searchParams.set("languageCode", "en");
    url.searchParams.set("pageSize", "5");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[FactCheck] Google API error: ${res.status}`);
      return [];
    }

    const data = await res.json() as {
      claims?: Array<{
        text?: string;
        claimReview?: Array<{
          textualRating?: string;
          publisher?: { name?: string; site?: string };
          url?: string;
          reviewDate?: string;
        }>;
      }>;
    };

    const results: FactCheckResult[] = [];

    for (const claim of data.claims || []) {
      for (const review of claim.claimReview || []) {
        if (review.url && review.publisher?.name) {
          results.push({
            claimText: claim.text || "",
            rating: review.textualRating || "Unknown",
            publisher: review.publisher.name,
            url: review.url,
            reviewDate: review.reviewDate,
          });
        }
      }
    }

    await cache.set(cacheKey, results, 7200); // 2-hour cache
    return results;
  }
}

// ── REGISTRY ──────────────────────────────────────────────────────────────────
const factCheckProviders: FactCheckProvider[] = [
  new GoogleFactCheckProvider(),
];

export async function queryFactChecks(claim: string): Promise<FactCheckResult[]> {
  for (const provider of factCheckProviders) {
    if (!provider.isAvailable()) continue;
    try {
      return await provider.query(claim);
    } catch (err) {
      console.warn(`[FactCheck] ${provider.name} failed:`, err);
    }
  }
  return [];
}
