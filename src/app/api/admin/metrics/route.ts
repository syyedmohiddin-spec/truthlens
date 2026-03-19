// src/app/api/admin/metrics/route.ts
// GET /api/admin/metrics
// Returns aggregate usage stats. Protected by ADMIN_SECRET env var when enabled.

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "@/lib/security";

function isAuthorized(req: NextRequest): boolean {
  if (process.env.ENABLE_ADMIN_AUTH !== "true") return true;
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function emptyMetrics() {
  return {
    ok: true,
    data: {
      totals: { analyses: 0 },
      window: {},
      verdicts: {},
      modes: {},
      performance: { avgLatencyMs: 0 },
      budget: { used: 0, limit: 0, remaining: 0 },
    },
  };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.json(emptyMetrics(), { headers: corsHeaders() });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [{ getPrisma }, { getCache, CacheKeys }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/cache"),
    ]);

    const prisma = getPrisma();
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600 * 1000);
    const dayAgo = new Date(now.getTime() - 86400 * 1000);

    const [
      totalAnalyses,
      lastHour,
      lastDay,
      verdictBreakdown,
      modeBreakdown,
      cacheHits,
      avgLatency,
      rateLimited,
      errors,
    ] = await Promise.all([
      prisma.analysis.count(),
      prisma.usageEvent.count({ where: { eventType: "analysis", createdAt: { gte: hourAgo } } }),
      prisma.usageEvent.count({ where: { eventType: "analysis", createdAt: { gte: dayAgo } } }),
      prisma.analysis.groupBy({ by: ["verdict"], _count: { verdict: true } }),
      prisma.analysis.groupBy({ by: ["synthesisMode"], _count: { synthesisMode: true } }),
      prisma.usageEvent.count({ where: { eventType: "cache_hit", createdAt: { gte: dayAgo } } }),
      prisma.usageEvent.aggregate({
        where: { eventType: "analysis", createdAt: { gte: dayAgo } },
        _avg: { latencyMs: true },
      }),
      prisma.usageEvent.count({ where: { eventType: "rate_limited", createdAt: { gte: dayAgo } } }),
      prisma.usageEvent.count({ where: { eventType: "error", createdAt: { gte: dayAgo } } }),
    ]);

    const cache = await getCache();
    const budgetKey = CacheKeys.budgetHour();
    const budgetState = await cache.get<{ count: number } | number>(budgetKey);
    const budgetUsed =
      typeof budgetState === "number"
        ? budgetState
        : typeof budgetState === "object" && budgetState !== null
          ? budgetState.count
          : 0;
    const budgetLimit = parseInt(process.env.SYNTHESIS_BUDGET_PER_HOUR || "100");

    return NextResponse.json({
      ok: true,
      data: {
        totals: { analyses: totalAnalyses },
        window: {
          lastHour,
          lastDay,
          cacheHits,
          rateLimited,
          errors,
        },
        verdicts: Object.fromEntries(
          verdictBreakdown.map((v) => [v.verdict, v._count.verdict])
        ),
        modes: Object.fromEntries(
          modeBreakdown.map((m) => [m.synthesisMode, m._count.synthesisMode])
        ),
        performance: {
          avgLatencyMs: Math.round(avgLatency._avg.latencyMs || 0),
        },
        budget: {
          used: budgetUsed,
          limit: budgetLimit,
          remaining: Math.max(0, budgetLimit - (budgetUsed as number)),
        },
      },
      headers: corsHeaders(),
    });
  } catch (err) {
    console.warn("[AdminMetrics] Falling back to empty metrics:", err);
    return NextResponse.json(emptyMetrics(), { headers: corsHeaders() });
  }
}
