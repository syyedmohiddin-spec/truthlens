// src/app/api/history/route.ts
// GET /api/history?sessionId=<hashed>
// Returns the last 20 analyses for a session (anonymous, no PII).

import { NextRequest, NextResponse } from "next/server";
import { deriveSessionId, extractIp, corsHeaders } from "@/lib/security";
import type { HistoryItem } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return NextResponse.json({ ok: true, data: [] }, { headers: corsHeaders() });
  }

  const rawIp = extractIp(req);
  const userAgent = req.headers.get("user-agent") || "";
  const sessionId = deriveSessionId(rawIp, userAgent);

  try {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    const entries = await prisma.historyEntry.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const items: HistoryItem[] = entries.map((e) => ({
      id: e.id,
      claimPreview: e.claimPreview,
      verdict: e.verdict as HistoryItem["verdict"],
      confidence: e.confidence,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json(
      { ok: true, data: items },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error("[History] Failed:", err);
    return NextResponse.json(
      { ok: true, data: [] },
      { headers: corsHeaders() }
    );
  }
}
