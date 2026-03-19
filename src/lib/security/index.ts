// src/lib/security/index.ts
// Security utilities: input validation, sanitization, IP extraction.
// None of these functions touch external services.

import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";

// ── INPUT VALIDATION SCHEMA ────────────────────────────────────────────────────
export const AnalysisRequestSchema = z.object({
  claim: z
    .string()
    .min(10, "Claim must be at least 10 characters")
    .max(600, "Claim must not exceed 600 characters")
    .transform((s) => s.trim()),
  sessionId: z.string().max(64).optional(),
});

export type ValidatedAnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

// ── TEXT SANITIZATION ─────────────────────────────────────────────────────────
// Remove HTML, script injection, and dangerous characters.
// Used on all user-provided text before processing or display.
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // strip control chars
}

// Sanitize for safe display in JSON (not HTML encoding, but safe strings)
export function sanitizeSnippet(text: string, maxLength = 500): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

// ── IP EXTRACTION ─────────────────────────────────────────────────────────────
// Extract IP from Next.js request headers.
// We never store the raw IP — only the hashed version.
export function extractIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ── SESSION ID GENERATION ─────────────────────────────────────────────────────
// Generates a session fingerprint from IP + UA.
// Not cryptographically user-identifying, just for history grouping.
export function deriveSessionId(ip: string, userAgent: string): string {
  const salt = process.env.IP_HASH_SALT || "truthlens-default-salt";
  return crypto
    .createHmac("sha256", salt)
    .update(`${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

// ── HASH HELPERS ──────────────────────────────────────────────────────────────
export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ── URL VALIDATION ────────────────────────────────────────────────────────────
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ── CORS HELPERS ──────────────────────────────────────────────────────────────
export function corsHeaders(): Record<string, string> {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── ERROR SANITIZATION ────────────────────────────────────────────────────────
// Never expose internal error details or stack traces to the client.
export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Strip anything that looks like a file path or stack trace
    return err.message
      .replace(/at .+\(.+\)/g, "")
      .replace(/\/[a-zA-Z0-9/_.-]+\.ts/g, "")
      .slice(0, 200);
  }
  return "An unexpected error occurred.";
}
