// src/lib/cache/index.ts
// Cache abstraction layer.
// Dev: in-process LRU map.
// Prod: drop in Redis by setting REDIS_URL env var.
// The interface is identical — only the backing store changes.

import type { CacheProvider } from "@/types";

// ── IN-PROCESS LRU CACHE (dev / single-instance) ─────────────────────────────
interface LRUEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

class LRUCacheProvider implements CacheProvider {
  private readonly store = new Map<string, LRUEntry<unknown>>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as LRUEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    if (this.store.size >= this.maxSize) {
      this.evictLRU();
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      lastAccessed: Date.now(),
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== null;
  }

  private evictLRU(): void {
    let oldest = Infinity;
    let oldestKey = "";
    for (const [key, entry] of this.store) {
      if (entry.lastAccessed < oldest) {
        oldest = entry.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }

  // Diagnostic helper (not in interface)
  size(): number {
    return this.store.size;
  }
}

// ── REDIS CACHE PROVIDER (production) ─────────────────────────────────────────
// Uses the ioredis-compatible interface. Only instantiated when REDIS_URL is set.
// We do a dynamic import so the server doesn't crash if ioredis isn't installed
// in environments where Redis isn't used.
class RedisCacheProvider implements CacheProvider {
  private client: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, exarg: "EX", ttl: number): Promise<unknown>;
    del(key: string): Promise<unknown>;
    exists(key: string): Promise<number>;
  };

  constructor(client: RedisCacheProvider["client"]) {
    this.client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Non-fatal: cache write failures are logged but don't break the pipeline
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      // Non-fatal
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch {
      return false;
    }
  }
}

// ── FACTORY ───────────────────────────────────────────────────────────────────
let _cache: CacheProvider | null = null;

export async function getCache(): Promise<CacheProvider> {
  if (_cache) return _cache;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const Redis = (await import("ioredis")).default as unknown as new (
        url: string
      ) => RedisCacheProvider["client"];
      const client = new Redis(redisUrl);
      _cache = new RedisCacheProvider(client);
      return _cache;
    } catch {
      console.warn("[Cache] Redis connection failed, falling back to LRU cache");
    }
  }

  _cache = new LRUCacheProvider(500);
  return _cache;
}

// ── CACHE KEY HELPERS ─────────────────────────────────────────────────────────
export const CacheKeys = {
  analysis: (claimHash: string) => `tl:analysis:${claimHash}`,
  retrieval: (queryHash: string) => `tl:retrieval:${queryHash}`,
  wiki: (wikiQuery: string) => `tl:wiki:${encodeURIComponent(wikiQuery)}`,
  factcheck: (claimHash: string) => `tl:fc:${claimHash}`,
  rateLimit: (ipHash: string, window: "hour" | "day") =>
    `tl:rl:${ipHash}:${window}`,
  budgetHour: () => {
    const d = new Date();
    const stamp = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}:${String(d.getUTCHours()).padStart(2, "0")}`;
    return `tl:budget:hour:${stamp}`;
  },
} as const;

// ── STALE-WHILE-REVALIDATE ────────────────────────────────────────────────────
export interface CachedValue<T> {
  data: T;
  cachedAt: number;
}

export async function getWithSWR<T>(
  cache: CacheProvider,
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number,
  staleSeconds: number
): Promise<{ data: T; cacheStatus: "hit" | "miss" | "stale" }> {
  const cached = await cache.get<CachedValue<T>>(key);

  if (cached) {
    const age = (Date.now() - cached.cachedAt) / 1000;
    if (age < ttlSeconds) {
      return { data: cached.data, cacheStatus: "hit" };
    }
    if (age < staleSeconds) {
      // Return stale data immediately; revalidate in background
      fetchFn()
        .then((fresh) =>
          cache.set<CachedValue<T>>(
            key,
            { data: fresh, cachedAt: Date.now() },
            staleSeconds
          )
        )
        .catch((e) => console.warn("[Cache] SWR revalidation failed:", e));
      return { data: cached.data, cacheStatus: "stale" };
    }
  }

  const fresh = await fetchFn();
  await cache.set<CachedValue<T>>(
    key,
    { data: fresh, cachedAt: Date.now() },
    staleSeconds
  );
  return { data: fresh, cacheStatus: "miss" };
}
