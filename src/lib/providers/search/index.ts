// src/lib/providers/search/index.ts
// SearchProvider implementations.
// Priority: Google CSE → Brave → DuckDuckGo Instant Answer (free fallback)
// All providers are swappable via the SearchProvider interface.

import type { SearchProvider, RawSource } from "@/types";
import { getCache, CacheKeys } from "@/lib/cache";
import crypto from "crypto";

function queryHash(query: string): string {
  return crypto.createHash("sha256").update(query.toLowerCase().trim()).digest("hex").slice(0, 16);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// ── GOOGLE CUSTOM SEARCH ──────────────────────────────────────────────────────
class GoogleSearchProvider implements SearchProvider {
  name = "google-cse";

  isAvailable(): boolean {
    return !!(
      process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID
    );
  }

  async search(query: string, limit = 5): Promise<RawSource[]> {
    const key = process.env.GOOGLE_SEARCH_API_KEY!;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID!;

    const cache = await getCache();
    const cacheKey = CacheKeys.retrieval(queryHash(query + ":google"));
    const cached = await cache.get<RawSource[]>(cacheKey);
    if (cached) return cached;

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", key);
    url.searchParams.set("cx", cx);
    url.searchParams.set("q", query);
    url.searchParams.set("num", String(Math.min(limit, 10)));
    url.searchParams.set("safe", "active");

    const res = await fetch(url.toString(), {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Google CSE error: ${res.status}`);
    }

    const data = await res.json() as {
      items?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
        pagemap?: { metatags?: Array<{ "article:published_time"?: string }> };
      }>;
    };

    const sources: RawSource[] = (data.items || []).map((item) => ({
      title: item.title || "Untitled",
      url: item.link || "",
      snippet: item.snippet || "",
      domain: extractDomain(item.link || ""),
      sourceType: "secondary" as const,
      publishedAt: item.pagemap?.metatags?.[0]?.["article:published_time"],
    }));

    await cache.set(cacheKey, sources, 1800);
    return sources;
  }
}

// ── SEARXNG SELF-HOSTED METASEARCH ────────────────────────────────────────────
class SearxngSearchProvider implements SearchProvider {
  name = "searxng";

  isAvailable(): boolean {
    return !!process.env.SEARXNG_URL;
  }

  async search(query: string, limit = 5): Promise<RawSource[]> {
    const base = process.env.SEARXNG_URL!;

    const cache = await getCache();
    const cacheKey = CacheKeys.retrieval(queryHash(query + ":searxng"));
    const cached = await cache.get<RawSource[]>(cacheKey);
    if (cached) return cached;

    const url = new URL(base.replace(/\/$/, "") + "/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("categories", "general");
    url.searchParams.set("language", "en");
    url.searchParams.set("safesearch", "1");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`SearXNG error: ${res.status}`);

    const data = await res.json() as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        publishedDate?: string;
      }>;
    };

    const sources: RawSource[] = (data.results || [])
      .slice(0, limit)
      .map((item) => ({
        title: item.title || "Untitled",
        url: item.url || "",
        snippet: item.content || "",
        domain: extractDomain(item.url || ""),
        sourceType: "secondary" as const,
        publishedAt: item.publishedDate,
      }))
      .filter((item) => item.url && item.title);

    await cache.set(cacheKey, sources, 1800);
    return sources;
  }
}

// ── BRAVE SEARCH ──────────────────────────────────────────────────────────────
class BraveSearchProvider implements SearchProvider {
  name = "brave";

  isAvailable(): boolean {
    return !!process.env.BRAVE_SEARCH_API_KEY;
  }

  async search(query: string, limit = 5): Promise<RawSource[]> {
    const key = process.env.BRAVE_SEARCH_API_KEY!;

    const cache = await getCache();
    const cacheKey = CacheKeys.retrieval(queryHash(query + ":brave"));
    const cached = await cache.get<RawSource[]>(cacheKey);
    if (cached) return cached;

    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(limit, 10)));
    url.searchParams.set("safesearch", "moderate");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Brave error: ${res.status}`);

    const data = await res.json() as {
      web?: {
        results?: Array<{
          title?: string;
          url?: string;
          description?: string;
          age?: string;
        }>;
      };
    };

    const sources: RawSource[] = (data.web?.results || []).map((item) => ({
      title: item.title || "Untitled",
      url: item.url || "",
      snippet: item.description || "",
      domain: extractDomain(item.url || ""),
      sourceType: "secondary" as const,
      publishedAt: item.age,
    }));

    await cache.set(cacheKey, sources, 1800);
    return sources;
  }
}

// ── DUCKDUCKGO INSTANT ANSWER (free, no key needed) ───────────────────────────
class DuckDuckGoProvider implements SearchProvider {
  name = "duckduckgo-instant";

  isAvailable(): boolean {
    return true; // Always available
  }

  async search(query: string, _limit = 5): Promise<RawSource[]> {
    const cache = await getCache();
    const cacheKey = CacheKeys.retrieval(queryHash(query + ":ddg"));
    const cached = await cache.get<RawSource[]>(cacheKey);
    if (cached) return cached;

    // DuckDuckGo Instant Answer API — returns related topics, not web results
    // This is a supplemental/fallback source, not a full search replacement
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`DDG error: ${res.status}`);

    const data = await res.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
      }>;
    };

    const sources: RawSource[] = [];

    if (data.AbstractText && data.AbstractURL) {
      sources.push({
        title: data.AbstractSource || "DuckDuckGo Abstract",
        url: data.AbstractURL,
        snippet: data.AbstractText.slice(0, 400),
        domain: extractDomain(data.AbstractURL),
        sourceType: "encyclopedia" as const,
      });
    }

    for (const topic of (data.RelatedTopics || []).slice(0, 3)) {
      if (topic.Text && topic.FirstURL) {
        sources.push({
          title: topic.Text.slice(0, 80),
          url: topic.FirstURL,
          snippet: topic.Text.slice(0, 300),
          domain: extractDomain(topic.FirstURL),
          sourceType: "secondary" as const,
        });
      }
    }

    await cache.set(cacheKey, sources, 3600);
    return sources;
  }
}

// ── PROVIDER REGISTRY ─────────────────────────────────────────────────────────
const providers: SearchProvider[] = [
  new SearxngSearchProvider(),
  new GoogleSearchProvider(),
  new BraveSearchProvider(),
  new DuckDuckGoProvider(),
];

export async function searchWithFallback(
  query: string,
  limit = 5
): Promise<RawSource[]> {
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    try {
      const results = await provider.search(query, limit);
      if (results.length > 0) return results;
    } catch (err) {
      console.warn(`[Search] Provider ${provider.name} failed:`, err);
      continue;
    }
  }
  return []; // All providers failed — pipeline continues with empty retrieval
}
