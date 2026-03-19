// __tests__/integration/analyze-route.test.ts
// Integration test for POST /api/analyze.
// Mocks the pipeline to avoid real API calls in CI.

import { NextRequest } from "next/server";

// Mock the entire pipeline module
jest.mock("@/lib/pipeline", () => ({
  runAnalysisPipeline: jest.fn(),
}));

// Mock quota module
jest.mock("@/lib/quota", () => ({
  checkIpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  consumeIpRateLimit: jest.fn().mockResolvedValue(undefined),
  hashIp: jest.fn().mockReturnValue("testhash"),
}));

import { POST } from "@/app/api/analyze/route";
import { runAnalysisPipeline } from "@/lib/pipeline";

const MOCK_RESULT = {
  ok: true,
  data: {
    verdict: "TRUE",
    confidence: 82,
    headline: "Confirmed: evidence supports this claim",
    summary: "Multiple credible sources confirm this claim.",
    category: "scientific",
    reasoning: [],
    sources: [],
    evidenceBreakdown: { supporting: 80, opposing: 20, consensus: 70, quality: 75 },
    radar: { accuracy: 82, diversity: 60, consensus: 70, recency: 65, verifiability: 75 },
    warnings: [],
    cacheStatus: "miss",
    latencyMs: 1200,
    synthesisMode: "rules",
  },
};

function makeRequest(body: unknown, ip = "127.0.0.1") {
  return new NextRequest("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": "jest-test/1.0",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (runAnalysisPipeline as jest.Mock).mockResolvedValue(MOCK_RESULT);
  });

  it("returns 200 with valid claim", async () => {
    const req = makeRequest({ claim: "The Earth is approximately 4.5 billion years old." });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.verdict).toBe("TRUE");
  });

  it("returns 400 for missing claim", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 for claim under 10 chars", async () => {
    const req = makeRequest({ claim: "short" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for claim over 600 chars", async () => {
    const req = makeRequest({ claim: "x".repeat(601) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
      body: "not json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    const { checkIpRateLimit } = await import("@/lib/quota");
    (checkIpRateLimit as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 60,
    });

    const req = makeRequest({ claim: "A valid claim for testing rate limits." });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe("RATE_LIMITED");
  });

  it("returns 500 on pipeline error", async () => {
    (runAnalysisPipeline as jest.Mock).mockRejectedValueOnce(
      new Error("Unexpected pipeline failure")
    );
    const req = makeRequest({ claim: "A valid claim to test error handling path." });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INTERNAL_ERROR");
    // Error message should NOT contain stack trace
    expect(json.error.message).not.toContain(".ts:");
  });

  it("calls pipeline with correct claim", async () => {
    const claim = "The moon landing was achieved in 1969.";
    const req = makeRequest({ claim });
    await POST(req);
    expect(runAnalysisPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ claim })
    );
  });
});
