// src/lib/providers/context/index.ts
// ContextProvider: Wikipedia REST API.
// Completely free, no key required.
// Returns article summary + thumbnail for relevant claims.

import type { ContextProvider, WikiContext } from "@/types";
import { getCache, CacheKeys } from "@/lib/cache";

class WikipediaContextProvider implements ContextProvider {
  name = "wikipedia";

  isAvailable(): boolean {
    return true; // Always available
  }

  async getContext(query: string): Promise<WikiContext | null> {
    const cache = await getCache();
    const cacheKey = CacheKeys.wiki(query);
    const cached = await cache.get<WikiContext>(cacheKey);
    if (cached) return cached;

    // Try exact title match first
    const context = await this.fetchSummary(
      query.replace(/ /g, "_")
    ) || await this.searchAndFetch(query);

    if (context) {
      await cache.set(cacheKey, context, 3600 * 12); // 12-hour cache
    }
    return context;
  }

  private async fetchSummary(title: string): Promise<WikiContext | null> {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "TruthLens/1.0 (fact-checking tool)" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;

      const data = await res.json() as {
        type?: string;
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        thumbnail?: { source?: string };
        timestamp?: string;
      };

      if (!data.extract || data.type === "disambiguation") return null;

      return {
        title: data.title || title,
        extract: data.extract.slice(0, 600),
        url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        thumbnailUrl: data.thumbnail?.source,
        lastModified: data.timestamp,
      };
    } catch {
      return null;
    }
  }

  private async searchAndFetch(query: string): Promise<WikiContext | null> {
    try {
      const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
      searchUrl.searchParams.set("action", "query");
      searchUrl.searchParams.set("list", "search");
      searchUrl.searchParams.set("srsearch", query);
      searchUrl.searchParams.set("format", "json");
      searchUrl.searchParams.set("origin", "*");
      searchUrl.searchParams.set("srlimit", "1");

      const res = await fetch(searchUrl.toString(), {
        headers: { "User-Agent": "TruthLens/1.0 (fact-checking tool)" },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;

      const data = await res.json() as {
        query?: { search?: Array<{ title?: string }> };
      };

      const title = data.query?.search?.[0]?.title;
      if (!title) return null;

      return this.fetchSummary(title);
    } catch {
      return null;
    }
  }
}

// ── REGISTRY ──────────────────────────────────────────────────────────────────
const contextProviders: ContextProvider[] = [
  new WikipediaContextProvider(),
];

export async function getClaimContext(query: string): Promise<WikiContext | null> {
  for (const provider of contextProviders) {
    if (!provider.isAvailable()) continue;
    try {
      const ctx = await provider.getContext(query);
      if (ctx) return ctx;
    } catch (err) {
      console.warn(`[Context] ${provider.name} failed:`, err);
    }
  }
  return null;
}
