// src/components/layout/Header.tsx — Vanta Editorial
"use client";
import React, { useEffect, useState } from "react";
import { cn } from "@/components/ui/primitives";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 14);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-[rgba(5,5,5,0.82)] backdrop-blur-2xl border-b border-[rgba(255,255,255,0.06)] shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
          : "bg-transparent"
      )}
    >
      <div className="page-wrap">
        <div className="flex items-center justify-between h-[70px] gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5" stroke="rgba(245,241,234,0.65)" strokeWidth="1" />
                <path d="M8 5.5L8 8L10 10" stroke="rgba(107,138,253,0.9)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.2 4.2L11.8 11.8M4.2 11.8L11.8 4.2" stroke="rgba(245,241,234,0.14)" strokeWidth="0.7" />
              </svg>
            </div>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-serif),Georgia,serif",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--pearl)",
              }}
            >
              TruthLens
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}>
              <div className="v-dot-live" />
              <span style={{
                fontFamily: "var(--font-mono),monospace",
                fontSize: "9px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--pearl-4)",
              }}>
                live synthesis
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.055)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
              }}>
              <span style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--blue)", boxShadow: "0 0 10px rgba(107,138,253,0.65)" }} />
              <span style={{
                fontFamily: "var(--font-mono),monospace",
                fontSize: "9px",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(245,241,234,0.42)",
              }}>
                openrouter • gemini • fact-check
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} className="mt-20 py-10">
      <div className="page-wrap">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="signature-container">
            <p style={{ fontFamily: "var(--font-serif),Georgia,serif", fontStyle: "italic", fontSize: "clamp(14px,1.6vw,18px)", color: "var(--pearl-4)", textAlign: "center" }}>
              Built by{" "}
              <span className="signature-name" style={{ fontFamily: "var(--font-serif),Georgia,serif", fontStyle: "italic", fontWeight: 700 }}>
                Syyed Mohiddin
              </span>
            </p>
          </div>
          <p style={{ fontFamily: "var(--font-mono),monospace", fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--pearl-5)" }}>
            Server-side AI · OpenRouter · Gemini · Google Fact Check · Zero client secrets
          </p>
        </div>
      </div>
    </footer>
  );
}
