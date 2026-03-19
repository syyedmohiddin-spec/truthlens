// src/app/page.tsx — Vanta Editorial main page
// Backend untouched. All API contracts preserved exactly.
"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Header, Footer } from "@/components/layout/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { LayerProgress, type Layer, type LayerState } from "@/components/verdict/LayerProgress";
import { VerdictPanel } from "@/components/verdict/VerdictPanel";
import { ConfidenceMeter } from "@/components/verdict/ConfidenceMeter";
import { ReasoningTimeline, SourceCards } from "@/components/verdict/ReasoningTimeline";
import { RadarChart, WikiContextPanel, FactCheckPanel } from "@/components/verdict/IntelligenceBreakdown";
import { ShareCard } from "@/components/verdict/ShareCard";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { smoothScrollToElement, smoothScrollToTop } from "@/lib/utils/scroll";
import type { AnalysisResult, ApiResponse } from "@/types";

const HERO_SIGNALS = [
  {
    icon: "↗",
    title: "Free-first synthesis",
    copy: "OpenRouter free router, Gemini fallback, Claude last. Server-side only.",
  },
  {
    icon: "◌",
    title: "Live public evidence",
    copy: "Web search, Wikipedia and fact-check tools are fused into one calm verdict.",
  },
  {
    icon: "✦",
    title: "Luxury motion system",
    copy: "Glass tilt, scan lines, shimmer and parallax tuned to stay elegant.",
  },
  {
    icon: "↺",
    title: "Cache-aware replies",
    copy: "Repeat claims are served through a cached analysis layer before new calls.",
  },
];

// ── LAYER DEFINITIONS (unchanged from backend contract) ────────────────────
const INITIAL_LAYERS: Layer[] = [
  { id: "normalize", icon: "🔬", name: "Claim Analysis", status: "idle", message: "Waiting…", barWidth: 0 },
  { id: "retrieval", icon: "🌐", name: "Live Web Intelligence", status: "idle", message: "Waiting…", barWidth: 0 },
  { id: "wikipedia", icon: "📚", name: "Wikipedia Cross-Reference", status: "idle", message: "Waiting…", barWidth: 0 },
  { id: "factcheck", icon: "🗂", name: "Google Fact Check DB", status: "idle", message: "Waiting…", barWidth: 0 },
  { id: "synthesis", icon: "🧠", name: "Server-side synthesis", status: "idle", message: "Waiting…", barWidth: 0 },
];

type AppState = "idle" | "analyzing" | "done" | "error";

// Scripted layer animation — visual feedback during async API call
function useLayers(isAnalyzing: boolean) {
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const timers = useRef<NodeJS.Timeout[]>([]);

  const set = useCallback((id: string, state: LayerState, msg: string, bar: number) => {
    setLayers((p) => p.map((l) => (l.id === id ? { ...l, status: state, message: msg, barWidth: bar } : l)));
  }, []);

  useEffect(() => {
    if (!isAnalyzing) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLayers(INITIAL_LAYERS.map((l) => ({ ...l, status: "idle" as const, barWidth: 0 })));
    const t = (ms: number, fn: () => void) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
    };
    t(100, () => set("normalize", "active", "Parsing claim structure…", 45));
    t(650, () => set("normalize", "done", "Claim parsed and categorized", 100));
    t(760, () => set("retrieval", "active", "Retrieving public evidence…", 32));
    t(920, () => set("wikipedia", "active", "Querying Wikipedia API…", 30));
    t(1650, () => set("wikipedia", "done", "Wikipedia context retrieved", 100));
    t(1750, () => set("factcheck", "active", "Querying Google Fact Check DB…", 50));
    t(2380, () => set("factcheck", "done", "Fact check database scanned", 100));
    t(2500, () => set("retrieval", "done", "Web sources retrieved and scored", 100));
    t(2650, () => set("synthesis", "active", "Synthesizing evidence and reasoning…", 65));
    return () => timers.current.forEach(clearTimeout);
  }, [isAnalyzing, set]);

  const finalize = useCallback((ok: boolean) => {
    setLayers((p) =>
      p.map((l) =>
        l.status === "active"
          ? { ...l, status: ok ? "done" : "failed", barWidth: 100, message: ok ? "Complete" : "Failed" }
          : l.status === "idle"
            ? { ...l, status: "skipped", message: "Bypassed" }
            : l
      )
    );
  }, []);

  return { layers, finalize };
}

// ── PAGE ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [claim, setClaim] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [histRefresh, setHistRefresh] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { layers, finalize } = useLayers(state === "analyzing");

  const submit = useCallback(
    async (text: string) => {
      if (!text || state === "analyzing") return;
      setClaim(text);
      setState("analyzing");
      setResult(null);
      setErrorMsg("");
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim: text }),
        });
        const json: ApiResponse = await res.json();
        if (!json.ok) {
          finalize(false);
          setErrorMsg(json.error.message || "TruthLens used a fallback path to stay available.");
          setState("error");
          return;
        }
        finalize(true);
        setResult(json.data);
        setState("done");
        setHistRefresh((n) => n + 1);
        setTimeout(() => smoothScrollToElement(resultsRef.current, -24), 380);
      } catch {
        finalize(false);
        setErrorMsg("Network error. Check your connection and try again.");
        setState("error");
      }
    },
    [state, finalize]
  );

  const rerun = useCallback(
    (c: string) => {
      smoothScrollToTop();
      setTimeout(() => submit(c), 280);
    },
    [submit]
  );

  return (
    <>
      <Header />
      <main className="vanta-scene relative z-10" style={{ minHeight: "100vh" }}>
        <div className="page-wrap relative z-10" style={{ paddingTop: "84px", paddingBottom: "20px" }}>
          {/* ── HERO ────────────────────────────────────────────── */}
          <section className="hero-shell text-center vanta-tilt-soft" style={{ marginTop: "clamp(28px, 4vh, 44px)", marginBottom: "28px" }}>
            <div className="animate-fade-in flex items-center justify-center gap-2.5 mb-5 hero-eyebrow mx-auto w-fit">
              <div className="v-dot-live" />
              <span style={{ fontFamily: "var(--font-mono),monospace", fontSize: "10px", letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--pearl-4)" }}>
                AI Fact Intelligence Engine · v4.0
              </span>
            </div>

            <h1 className="type-hero animate-fade-up delay-100" style={{ marginBottom: "16px" }}>
              Analyze <em style={{ fontStyle: "italic", color: "rgba(245,241,234,0.88)" }}>Reality.</em>
            </h1>

            <p
              className="animate-fade-up delay-200"
              style={{
                fontFamily: "var(--font-sans),system-ui,sans-serif",
                fontSize: "clamp(14px,1.9vw,17px)",
                color: "rgba(245,241,234,0.56)",
                maxWidth: "560px",
                margin: "0 auto 24px",
                lineHeight: 1.78,
                fontWeight: 300,
              }}
            >
              Five intelligence layers. Server-side AI. No client-side secrets. A calm, luxurious truth engine built for precision and speed.
            </p>

            <div className="hero-glass-caption animate-fade-up delay-300 mb-9">
              {[
                "Server-side AI",
                "Wikipedia REST",
                "Google Fact Check",
                "Live Web Search",
              ].map((b) => (
                <span key={b} className="v-badge" style={{ cursor: "default" }}>
                  {b}
                </span>
              ))}
            </div>

            <div className="hero-signal-grid animate-fade-up delay-400">
              {HERO_SIGNALS.map((item) => (
                <div key={item.title} className="hero-signal-card vanta-tilt-soft">
                  <div className="hero-signal-top">
                    <div className="hero-signal-icon" aria-hidden="true">
                      <span style={{ fontFamily: "var(--font-mono),monospace", fontSize: "11px", lineHeight: 1 }}>{item.icon}</span>
                    </div>
                    <div style={{ minWidth: 0, textAlign: "left" }}>
                      <div className="hero-signal-title">{item.title}</div>
                    </div>
                  </div>
                  <div className="hero-signal-copy" style={{ textAlign: "left" }}>{item.copy}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SEARCH BAR ─────────────────────────────────────── */}
          <section style={{ marginBottom: "28px" }}>
            <SearchBar onSubmit={submit} loading={state === "analyzing"} />
          </section>

          {/* ── LAYER PROGRESS ────────────────────────────────── */}
          {(state === "analyzing" || state === "done" || state === "error") && (
            <section style={{ maxWidth: "760px", margin: "0 auto 28px" }}>
              <LayerProgress layers={layers} />
            </section>
          )}

          {/* ── ERROR STATE ───────────────────────────────────── */}
          {state === "error" && (
            <div
              className="animate-fade-up vanta-tilt-soft"
              style={{
                maxWidth: "760px",
                margin: "0 auto 28px",
                background: "rgba(248,113,113,0.05)",
                border: "1px solid rgba(248,113,113,0.18)",
                borderRadius: "18px",
                padding: "14px 18px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <p style={{ fontFamily: "var(--font-sans),system-ui,sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--v-false)", marginBottom: "4px" }}>
                Analysis failed
              </p>
              <p style={{ fontFamily: "var(--font-sans),system-ui,sans-serif", fontSize: "12px", color: "rgba(248,113,113,0.68)", lineHeight: 1.65 }}>
                {errorMsg}
              </p>
            </div>
          )}

          {/* ── RESULTS ───────────────────────────────────────── */}
          {state === "done" && result && (
            <div ref={resultsRef} style={{ marginBottom: "48px" }}>
              <div className="result-layout" style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <VerdictPanel result={result} />
                  <ConfidenceMeter confidence={result.confidence} evidenceBreakdown={result.evidenceBreakdown} />
                  <ReasoningTimeline steps={result.reasoning} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <SourceCards sources={result.sources} />
                  <RadarChart scores={result.radar} />
                  {result.sources.some((s) => s.sourceType === "encyclopedia") && null}
                  <FactCheckPanel factChecks={result.factChecks ?? []} />
                  <ShareCard claim={claim} result={result} />
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORY ───────────────────────────────────────── */}
          <section style={{ marginBottom: "24px" }}>
            <HistoryPanel onSelect={rerun} refreshTrigger={histRefresh} />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
