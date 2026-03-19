// src/lib/quota/index.ts
// Rate limiting and budget governance.
// Uses database for persistence across restarts.
// Sliding window algorithm.

import crypto from "crypto";
import { getPrisma } from "@/lib/db";
import { getCache, CacheKeys } from "@/lib/cache";
import type { QuotaProvider, QuotaResult } from "@/types";

// ── IP HASHING ────────────────────────────────────────────────────────────────
// We never store raw IPs. Only HMAC-SHA256 of IP + secret salt.
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "truthlens-default-salt";
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 16);
}

// ── DB-BACKED QUOTA PROVIDER ──────────────────────────────────────────────────
class DbQuotaProvider implements QuotaProvider {
  async check(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<QuotaResult> {
    const prisma = getPrisma();
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    const existing = await prisma.rateLimitBucket.findUnique({
      where: { key },
    });

    if (!existing || existing.resetAt <= now) {
      // Window expired or first request — reset
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt,
      };
    }

    const remaining = limit - existing.count;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining - 1),
      resetAt: existing.resetAt,
    };
  }

  async increment(key: string, windowSeconds: number): Promise<void> {
    const prisma = getPrisma();
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: {
        count: { increment: 1 },
        resetAt: {
          set: (
            await prisma.rateLimitBucket
              .findUnique({ where: { key } })
              .then((b) => (b && b.resetAt > now ? b.resetAt : resetAt))
          ) as Date,
        },
      },
    });
  }
}

// Singleton
let _quota: QuotaProvider | null = null;
export function getQuota(): QuotaProvider {
  if (!_quota) _quota = new DbQuotaProvider();
  return _quota;
}

async function readCachedWindow(key: string, limit: number, windowSeconds: number) {
  const cache = await getCache();
  const now = Date.now();
  const cached = await cache.get<{ count: number; resetAt: number }>(key);
  if (!cached || cached.resetAt <= now) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  const remaining = limit - cached.count;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining - 1),
    resetAt: new Date(cached.resetAt),
  };
}

async function writeCachedWindow(key: string, windowSeconds: number): Promise<void> {
  const cache = await getCache();
  const now = Date.now();
  const current = await cache.get<{ count: number; resetAt: number }>(key);
  if (!current || current.resetAt <= now) {
    await cache.set(key, { count: 1, resetAt: now + windowSeconds * 1000 }, windowSeconds);
    return;
  }

  await cache.set(
    key,
    { count: current.count + 1, resetAt: current.resetAt },
    Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  );
}

// ── RATE LIMIT HELPERS ────────────────────────────────────────────────────────
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;

export async function checkIpRateLimit(ipHash: string): Promise<{
  allowed: boolean;
  retryAfter?: number;
}> {
  const quota = getQuota();

  const hourLimit = parseInt(process.env.RATE_LIMIT_PER_IP_PER_HOUR || "10");
  const dayLimit = parseInt(process.env.RATE_LIMIT_PER_IP_PER_DAY || "50");

  try {
    const hourResult = await quota.check(
      `ip:${ipHash}:hour`,
      hourLimit,
      HOUR_SECONDS
    );
    if (!hourResult.allowed) {
      const retryAfter = Math.ceil(
        (hourResult.resetAt.getTime() - Date.now()) / 1000
      );
      return { allowed: false, retryAfter };
    }

    const dayResult = await quota.check(
      `ip:${ipHash}:day`,
      dayLimit,
      DAY_SECONDS
    );
    if (!dayResult.allowed) {
      const retryAfter = Math.ceil(
        (dayResult.resetAt.getTime() - Date.now()) / 1000
      );
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  } catch (err) {
    console.warn("[Quota] DB rate-limit check failed; using cache fallback:", err);

    const hourResult = await readCachedWindow(CacheKeys.rateLimit(ipHash, "hour"), hourLimit, HOUR_SECONDS);
    if (!hourResult.allowed) {
      const retryAfter = Math.ceil((hourResult.resetAt.getTime() - Date.now()) / 1000);
      return { allowed: false, retryAfter };
    }

    const dayResult = await readCachedWindow(CacheKeys.rateLimit(ipHash, "day"), dayLimit, DAY_SECONDS);
    if (!dayResult.allowed) {
      const retryAfter = Math.ceil((dayResult.resetAt.getTime() - Date.now()) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }
}

export async function consumeIpRateLimit(ipHash: string): Promise<void> {
  const quota = getQuota();
  try {
    await Promise.all([
      quota.increment(`ip:${ipHash}:hour`, HOUR_SECONDS),
      quota.increment(`ip:${ipHash}:day`, DAY_SECONDS),
    ]);
  } catch (err) {
    console.warn("[Quota] DB rate-limit increment failed; using cache fallback:", err);
    await Promise.all([
      writeCachedWindow(CacheKeys.rateLimit(ipHash, "hour"), HOUR_SECONDS),
      writeCachedWindow(CacheKeys.rateLimit(ipHash, "day"), DAY_SECONDS),
    ]);
  }
}

// ── SYNTHESIS BUDGET GOVERNOR ─────────────────────────────────────────────────
// Global budget: max Claude calls per hour regardless of which IP
export async function checkSynthesisBudget(): Promise<boolean> {
  const quota = getQuota();
  const limit = parseInt(process.env.SYNTHESIS_BUDGET_PER_HOUR || "100");
  try {
    const result = await quota.check(
      CacheKeys.budgetHour(),
      limit,
      HOUR_SECONDS
    );
    return result.allowed;
  } catch (err) {
    console.warn("[Quota] DB synthesis-budget check failed; using cache fallback:", err);
    const fallback = await readCachedWindow(CacheKeys.budgetHour(), limit, HOUR_SECONDS);
    return fallback.allowed;
  }
}

export async function consumeSynthesisBudget(): Promise<void> {
  const quota = getQuota();
  try {
    await quota.increment(CacheKeys.budgetHour(), HOUR_SECONDS);
  } catch (err) {
    console.warn("[Quota] DB synthesis-budget increment failed; using cache fallback:", err);
    await writeCachedWindow(CacheKeys.budgetHour(), HOUR_SECONDS);
  }
}
