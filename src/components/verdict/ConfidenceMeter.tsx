// src/components/verdict/ConfidenceMeter.tsx — Vanta Editorial
"use client";
import React, { useEffect, useState } from "react";
import type { EvidenceBreakdown } from "@/types";

function useCountUp(target: number, delay = 280, dur = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const s = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - s) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(e * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay, dur]);
  return val;
}

interface Props { confidence: number; evidenceBreakdown: EvidenceBreakdown; }

export function ConfidenceMeter({ confidence, evidenceBreakdown }: Props) {
  const animated = useCountUp(confidence, 320);
  const confColor = confidence >= 72 ? "var(--v-true)" : confidence >= 45 ? "var(--v-mixed)" : "var(--v-false)";
  const fillGradient = confidence >= 72
    ? `linear-gradient(90deg, rgba(74,222,128,0.6), var(--v-true))`
    : confidence >= 45
    ? `linear-gradient(90deg, rgba(244,185,97,0.6), var(--v-mixed))`
    : `linear-gradient(90deg, rgba(248,113,113,0.6), var(--v-false))`;

  const bars = [
    { label:"Supporting evidence", value:evidenceBreakdown.supporting, color:"var(--v-true)" },
    { label:"Opposing evidence",   value:evidenceBreakdown.opposing,   color:"var(--v-false)" },
    { label:"Source consensus",    value:evidenceBreakdown.consensus,   color:"var(--blue)" },
    { label:"Source quality",      value:evidenceBreakdown.quality,     color:"var(--amber)" },
  ];

  return (
    <div className="crystal-elevated result-reveal delay-100 vanta-tilt-soft" style={{ padding:"20px 22px" }}>
      <div className="v-section-label"><span>Confidence analysis</span></div>

      {/* Main value + pulse ring */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
        <span style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"12px", color:"rgba(245,241,234,0.45)" }}>
          Overall confidence
        </span>
        <div className="confidence-pulse-wrap" style={{ width:"56px", height:"56px" }}>
          <span style={{ fontFamily:"var(--font-serif),Georgia,serif", fontSize:"26px", fontWeight:800, color:confColor, lineHeight:1, position:"relative", zIndex:1 }}>
            {animated}%
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div className="conf-track" style={{ marginBottom:"6px" }}>
        <div className="conf-fill" style={{ width:`${animated}%`, background:fillGradient }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"16px" }}>
        {["0","50","100"].map(v => (
          <span key={v} style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", color:"rgba(245,241,234,0.22)" }}>{v}</span>
        ))}
      </div>

      {/* Evidence breakdown bars */}
      <div style={{ display:"flex", flexDirection:"column", gap:"10px", paddingTop:"14px", borderTop:"1px solid rgba(255,255,255,0.055)" }}>
        {bars.map(b => (
          <EvidBar key={b.label} {...b} />
        ))}
      </div>
    </div>
  );
}

function EvidBar({ label, value, color }: { label:string; value:number; color:string }) {
  const v = useCountUp(value, 480, 1000);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
        <span style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.48)" }}>{label}</span>
        <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"10px", fontWeight:600, color }}>{v}%</span>
      </div>
      <div style={{ height:"3px", background:"rgba(255,255,255,0.055)", borderRadius:"2px", overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:"2px", background:color, width:`${v}%`, transition:"width 1.0s var(--ease-expo)" }} />
      </div>
    </div>
  );
}
