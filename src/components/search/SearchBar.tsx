// src/components/search/SearchBar.tsx — Vanta Editorial crystalline input slate
"use client";
import React, { useRef, useState, useCallback } from "react";

const SAMPLES = [
  { label: "Great Wall myth", text: "The Great Wall of China is visible from space with the naked eye" },
  { label: "Brain myth", text: "Humans only use 10% of their brain" },
  { label: "India population", text: "India has surpassed China as the world's most populous country" },
  { label: "Lightning myth", text: "Lightning never strikes the same place twice" },
  { label: "Earth age", text: "The Earth is approximately 4.5 billion years old" },
];
const MAX = 600;

interface SearchBarProps { onSubmit: (claim: string) => void; loading: boolean; }

export function SearchBar({ onSubmit, loading }: SearchBarProps) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 190) + "px";
    }
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value.slice(0, MAX));
    resize();
  }, [resize]);

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && value.trim().length >= 10 && !loading) {
      e.preventDefault();
      onSubmit(value.trim());
    }
  }, [value, onSubmit, loading]);

  const clear = () => {
    setValue("");
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.focus();
    }
  };

  const load = (t: string) => {
    setValue(t);
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 190) + "px";
      ta.focus();
    }
  };

  const pct = value.length / MAX;
  const warn = pct > 0.85;
  const ok = value.trim().length >= 10 && !loading;

  return (
    <div className="animate-fade-up delay-300 w-full max-w-[760px] mx-auto vanta-scene">
      <p className="type-label mb-2.5">Claim input</p>

      <div className="input-slate vanta-tilt-soft analysis-stage">
        {loading && (
          <div className="scan-line-container">
            <div className="scan-line" />
          </div>
        )}

        <div className="flex items-start gap-0 relative z-10">
          <div
            className="pt-[18px] pl-5 pr-3 flex-shrink-0"
            style={{
              fontFamily: "var(--font-mono),monospace",
              fontSize: "13px",
              color: "rgba(107,138,253,0.55)",
              userSelect: "none",
            }}
            aria-hidden="true"
          >
            &gt;
          </div>

          <textarea
            ref={taRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder={loading ? "Synthesizing sources... applying reasoning logic..." : "Paste a claim or news source below for intelligent verification..."}
            rows={2}
            aria-label="Claim to fact-check"
            aria-busy={loading}
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: "var(--pearl)",
              fontSize: "15px",
              lineHeight: "1.60",
              padding: "18px 0 16px",
              minHeight: "56px",
              maxHeight: "190px",
              fontFamily: "var(--font-sans),system-ui,sans-serif",
              opacity: loading ? 0.8 : 1,
              transition: "opacity var(--t-fast) ease",
            }}
            className="placeholder:text-[rgba(245,241,234,0.28)]"
          />
        </div>

        <div
          className="flex flex-col gap-3 px-5 py-3.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.055)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              style={{
                fontFamily: "var(--font-mono),monospace",
                fontSize: "10px",
                color: warn ? "var(--amber)" : "rgba(245,241,234,0.25)",
                transition: "color 0.2s ease",
              }}
            >
              {value.length} / {MAX}
            </span>

            <div className="flex items-center gap-2.5">
              {value.length > 0 && (
                <button
                  onClick={clear}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(245,241,234,0.35)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--v-false)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(245,241,234,0.35)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                  }}
                  aria-label="Clear input"
                  disabled={loading}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => ok && onSubmit(value.trim())}
                disabled={!ok}
                aria-label="Analyze claim"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "9px 22px",
                  borderRadius: "999px",
                  background: ok ? "linear-gradient(180deg, rgba(107,138,253,1), rgba(91,118,252,0.96))" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${ok ? "rgba(107,138,253,0.0)" : "rgba(255,255,255,0.08)"}`,
                  color: ok ? "#050505" : "rgba(245,241,234,0.28)",
                  fontFamily: "var(--font-sans),system-ui,sans-serif",
                  fontWeight: 650,
                  fontSize: "12px",
                  letterSpacing: "0.02em",
                  cursor: ok ? "pointer" : "not-allowed",
                  transition: "transform 0.25s var(--ease-expo), box-shadow 0.25s var(--ease-expo), background 0.25s ease, opacity 0.25s ease",
                  opacity: loading ? 0.7 : 1,
                  boxShadow: ok ? "0 16px 32px rgba(107,138,253,0.16)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (ok) {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.transform = "translateY(-1px)";
                    b.style.boxShadow = "0 18px 34px rgba(107,138,253,0.28)";
                  }
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.transform = "";
                  b.style.boxShadow = ok ? "0 16px 32px rgba(107,138,253,0.16)" : "none";
                }}
                onMouseDown={(e) => {
                  if (ok) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.975)";
                }}
                onMouseUp={(e) => {
                  if (ok) (e.currentTarget as HTMLButtonElement).style.transform = "";
                }}
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M21.73 18L13.73 4a2 2 0 00-3.46 0L2.27 18A2 2 0 004 21h16a2 2 0 001.73-3z" />
                      <path d="M12 9v4M12 17h.01" />
                    </svg>
                    Analyze
                  </>
                )}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-between gap-3">
              <div className="proc-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono),monospace",
                  fontSize: "9px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(245,241,234,0.42)",
                }}
              >
                Synthesizing sources · Applying reasoning logic
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span
                style={{
                  fontFamily: "var(--font-mono),monospace",
                  fontSize: "9px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(245,241,234,0.32)",
                }}
              >
                Press Enter to analyze
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono),monospace",
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: warn ? "var(--amber)" : "rgba(245,241,234,0.22)",
                }}
              >
                {warn ? "Character budget nearly full" : "Clean input · clear verdict"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3.5 justify-center">
        {SAMPLES.map((s, index) => (
          <button
            key={s.label}
            onClick={() => load(s.text)}
            className="transition-all duration-200 hover:-translate-y-px active:scale-95"
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.025)",
              fontFamily: "var(--font-sans),system-ui,sans-serif",
              fontSize: "11px",
              color: "rgba(245,241,234,0.50)",
              cursor: "pointer",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              animationDelay: `${index * 0.06}s`,
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget;
              b.style.borderColor = "rgba(107,138,253,0.35)";
              b.style.color = "var(--blue)";
              b.style.background = "rgba(107,138,253,0.06)";
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget;
              b.style.borderColor = "rgba(255,255,255,0.07)";
              b.style.color = "rgba(245,241,234,0.50)";
              b.style.background = "rgba(255,255,255,0.025)";
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
