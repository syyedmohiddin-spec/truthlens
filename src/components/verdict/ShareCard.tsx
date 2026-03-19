// src/components/verdict/ShareCard.tsx — Vanta Editorial
"use client";
import React, { useState } from "react";
import type { AnalysisResult, Verdict } from "@/types";

const VL: Record<Verdict,string> = {
  TRUE:"VERIFIED TRUE", FALSE:"VERIFIED FALSE", MIXED:"MIXED / PARTIAL", UNVERIFIED:"UNVERIFIED"
};
const VC: Record<Verdict,string> = {
  TRUE:"var(--v-true)", FALSE:"var(--v-false)", MIXED:"var(--v-mixed)", UNVERIFIED:"var(--v-unverified)"
};

export function ShareCard({ claim, result }: { claim:string; result:AnalysisResult }) {
  const [copied, setCopied] = useState(false);
  const color = VC[result.verdict];
  const label = VL[result.verdict];
  const text = [`🔍 TruthLens Fact-Check`,``,`Claim: "${claim.slice(0,120)}${claim.length>120?"…":""}"`,``,`Verdict: ${label} (${result.confidence}% confidence)`,``,result.summary.slice(0,200)].join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const el=document.createElement("textarea"); el.value=text; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };
  const toX  = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🔍 Fact-checked by TruthLens AI\n\n"${claim.slice(0,80)}…"\n\nVerdict: ${label} (${result.confidence}% confidence)\n\n#FactCheck #TruthLens`)}`, "_blank","noopener,noreferrer");
  const toWA = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`*🔍 TruthLens Fact-Check*\n\n*Claim:* "${claim.slice(0,100)}"\n*Verdict:* ${label}\n*Confidence:* ${result.confidence}%\n\n_${result.summary.slice(0,200)}_`)}`, "_blank","noopener,noreferrer");

  const btnBase: React.CSSProperties = {
    display:"inline-flex", alignItems:"center", gap:"6px",
    padding:"8px 18px", borderRadius:"999px",
    fontFamily:"var(--font-sans),system-ui,sans-serif",
    fontSize:"12px", fontWeight:600, cursor:"pointer",
    transition:"all 0.22s var(--ease-expo)",
  };

  return (
    <div className="crystal result-reveal delay-500 vanta-tilt-soft" style={{ padding:"18px 20px" }}>
      <div className="v-section-label"><span>Share this verdict</span></div>

      {/* Preview card */}
      <div style={{
        background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:"10px", padding:"14px 16px", marginBottom:"14px",
        position:"relative", overflow:"hidden",
      }}>
        {/* Top accent */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"1px", background:color, opacity:0.7 }} />
        <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"8px", letterSpacing:"0.20em", textTransform:"uppercase", color:"rgba(245,241,234,0.28)", marginBottom:"8px" }}>
          TruthLens · AI Fact Intelligence
        </p>
        <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"13px", color:"var(--pearl)", fontStyle:"italic", marginBottom:"9px", lineHeight:1.5, paddingRight:"60px" }}>
          "{claim.slice(0,110)}{claim.length>110?"…":""}"
        </p>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", color }}>{label}</span>
          <span style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.38)" }}>{result.confidence}% confidence</span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
        <button onClick={copy} style={{ ...btnBase, background:"rgba(107,138,253,0.08)", border:"1px solid rgba(107,138,253,0.25)", color:"var(--blue)" }}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(107,138,253,0.14)"}
          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(107,138,253,0.08)"}>
          {copied?"✓ Copied":"📋 Copy verdict"}
        </button>
        <button onClick={toX} style={{ ...btnBase, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.10)", color:"var(--pearl-2)" }}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.08)"}
          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(255,255,255,0.04)"}>
          𝕏 Share
        </button>
        <button onClick={toWA} style={{ ...btnBase, background:"rgba(37,211,102,0.07)", border:"1px solid rgba(37,211,102,0.25)", color:"#25d166" }}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(37,211,102,0.12)"}
          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="rgba(37,211,102,0.07)"}>
          💬 WhatsApp
        </button>
      </div>
    </div>
  );
}
