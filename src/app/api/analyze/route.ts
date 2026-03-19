// src/app/api/analyze/route.ts
// POST /api/analyze
// The only public API endpoint that runs the full analysis pipeline.
// Handles: validation, rate limiting, pipeline invocation, error mapping.
// ALL secrets and AI calls happen here — never in client code.

import { NextRequest, NextResponse } from "next/server";
import { checkIpRateLimit, consumeIpRateLimit, hashIp } from "@/lib/quota";
import {
  extractIp,
  deriveSessionId,
  AnalysisRequestSchema,
  corsHeaders,
  sanitizeError,
} from "@/lib/security";

// ── OPTIONS (CORS preflight) ──────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ── POST /api/analyze ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const startMs = Date.now();

  // 1. Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "Invalid JSON body." } },
      { status: 400, headers: corsHeaders() }
    );
  }

  const parsed = AnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: first?.message || "Invalid request.",
        },
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  const { claim } = parsed.data;

  // 2. Extract IP and session (hashed — never store raw values)
  const rawIp = extractIp(req);
  const ipHash = hashIp(rawIp);
  const userAgent = req.headers.get("user-agent") || "";
  const sessionId = deriveSessionId(rawIp, userAgent);

  // 3. Rate limit check
  const { allowed, retryAfter } = await checkIpRateLimit(ipHash);
  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait before trying again.",
          retryAfter,
        },
      },
      {
        status: 429,
        headers: {
          ...corsHeaders(),
          "Retry-After": String(retryAfter || 60),
          "X-RateLimit-Reset": String(Date.now() + (retryAfter || 60) * 1000),
        },
      }
    );
  }

  // 4. Consume rate limit token
  await consumeIpRateLimit(ipHash);

  // 5. Run pipeline
  try {
    const { runAnalysisPipeline } = await import("@/lib/pipeline");
    const result = await runAnalysisPipeline({
      claim,
      sessionId,
      ipHash,
    });

    if (!result.ok) {
      const statusCode =
        result.error.code === "RATE_LIMITED"
          ? 429
          : result.error.code === "CLAIM_TOO_SHORT" ||
            result.error.code === "CLAIM_TOO_LONG" ||
            result.error.code === "INVALID_INPUT" ||
            result.error.code === "CLAIM_UNCHECKABLE"
          ? 422
          : 500;

      return NextResponse.json(result, {
        status: statusCode,
        headers: corsHeaders(),
      });
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store",
        "X-Analysis-Mode": result.data.synthesisMode,
        "X-Cache-Status": result.data.cacheStatus,
        "X-Latency-Ms": String(result.data.latencyMs),
      },
    });
  } catch (err) {
    console.error("[API] Unhandled error in /api/analyze:", err);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: sanitizeError(err),
        },
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
