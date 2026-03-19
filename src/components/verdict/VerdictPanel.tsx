// src/components/verdict/VerdictPanel.tsx — Vanta Editorial glass banner
"use client";
import React from "react";
import type { AnalysisResult, Verdict } from "@/types";

const VC: Record<Verdict, { color: string; label: string; icon: string }> = {
  TRUE: { color: "var(--v-true)", label: "Verified True", icon: "✓" },
  FALSE: { color: "var(--v-false)", label: "Verified False", icon: "✗" },
  MIXED: { color: "var(--v-mixed)", label: "Mixed / Partial", icon: "≈" },
  UNVERIFIED: { color: "var(--v-unverified)", label: "Unverified", icon: "?" },
};

const AI_PROVIDERS: Record<string, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export function VerdictPanel({ result }: { result: AnalysisResult }) {
  const cfg = VC[result.verdict] ?? VC.UNVERIFIED;
  const isAi = ["claude", "gemini", "openrouter"].includes(result.synthesisMode);
  const modelLabel = result.synthesisMode === "cached"
    ? "cache"
    : result.synthesisMode === "rules"
      ? "rules engine"
      : AI_PROVIDERS[result.synthesisMode] || result.synthesisMode;

  return (
    <div className="verdict-banner result-reveal vanta-tilt" data-verdict={result.verdict}>
      <div style={{ padding: "22px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono),monospace", fontSize: "9px", letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--pearl-4)" }}>
            {result.category}
          </span>
          {isAi && (
            <span className="v-badge" style={{ fontSize: "8px", color: "var(--blue)", borderColor: "rgba(107,138,253,0.25)", background: "rgba(107,138,253,0.07)" }}>
              {modelLabel}
            </span>
          )}
          {result.cacheStatus !== "miss" && (
            <span className="v-badge" style={{ fontSize: "8px" }}>
              {result.cacheStatus === "hit" ? "cached" : "stale"}
            </span>
          )}
        </div>

        <div className="verdict-badge-wrap" style={{ marginBottom: "18px" }}>
          <div
            className={`verdict-${result.verdict}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 20px",
              borderRadius: "12px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
          >
            <span style={{ fontSize: "20px", lineHeight: 1, color: cfg.color }}>{cfg.icon}</span>
            <span className="type-verdict-display" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        </div>

        <h2
          style={{
            fontFamily: "var(--font-serif),Georgia,serif",
            fontSize: "clamp(18px,3.2vw,26px)",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: "var(--pearl)",
            marginBottom: "12px",
          }}
        >
          {result.headline}
        </h2>

        <p
          style={{
            fontSize: "14px",
            color: "rgba(245,241,234,0.72)",
            lineHeight: 1.75,
            fontStyle: "italic",
            paddingLeft: "14px",
            borderLeft: `2px solid ${cfg.color}`,
            marginBottom: "16px",
          }}
        >
          {result.summary}
        </p>

        {result.warnings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
            {result.warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  background: "rgba(244,185,97,0.06)",
                  border: "1px solid rgba(244,185,97,0.18)",
                  borderRadius: "10px",
                  padding: "9px 12px",
                  fontFamily: "var(--font-sans),system-ui,sans-serif",
                  fontSize: "12px",
                  color: "rgba(244,185,97,0.88)",
                  lineHeight: 1.55,
                }}
              >
                <span style={{ flexShrink: 0, marginTop: "1px" }}>⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "11px 24px",
          borderTop: "1px solid rgba(255,255,255,0.055)",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        {[
          ["Model", modelLabel],
          ["Sources", `${result.sources.length} found`],
          ["Latency", `${result.latencyMs}ms`],
          ["Confidence", `${result.confidence}%`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontFamily: "var(--font-mono),monospace", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,234,0.28)" }}>
              {k}:
            </span>
            <span style={{ fontFamily: "var(--font-mono),monospace", fontSize: "9px", color: "rgba(245,241,234,0.55)" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
