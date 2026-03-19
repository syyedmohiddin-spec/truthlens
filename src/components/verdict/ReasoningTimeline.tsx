// src/components/verdict/ReasoningTimeline.tsx — Vanta Editorial
"use client";
import React from "react";
import { cn } from "@/components/ui/primitives";
import type { ReasoningStep, ScoredSource } from "@/types";

// ── REASONING TIMELINE ────────────────────────────────────────────────────────
export function ReasoningTimeline({ steps }: { steps: ReasoningStep[] }) {
  if (!steps.length) return null;
  return (
    <div className="crystal-elevated result-reveal delay-200 vanta-tilt-soft" style={{ padding:"20px 22px" }}>
      <div className="v-section-label"><span>AI reasoning chain</span></div>
      <div style={{ position:"relative" }}>
        {/* Gradient connector line */}
        <div style={{
          position:"absolute", left:"17px", top:"20px", bottom:"20px", width:"1px",
          background:"linear-gradient(to bottom, var(--blue), rgba(107,138,253,0.15), rgba(107,138,253,0.04))",
          opacity:0.35
        }} />
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {steps.map((s, i) => (
            <div key={i} className="animate-fade-up" style={{ animationDelay:`${i*0.09}s`, display:"flex", gap:"13px" }}>
              {/* Node */}
              <div style={{
                width:"34px", height:"34px", borderRadius:"50%",
                border:`1.5px solid ${s.color||"var(--blue)"}`,
                background:"var(--void)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"14px", flexShrink:0, position:"relative", zIndex:1,
              }}>
                {s.icon}
              </div>
              {/* Content */}
              <div style={{ paddingTop:"6px", flex:1 }}>
                <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", letterSpacing:"0.18em", textTransform:"uppercase", color:s.color||"var(--blue)", marginBottom:"5px" }}>
                  {s.step}
                </p>
                <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"13px", color:"rgba(245,241,234,0.68)", lineHeight:1.65 }}>
                  {s.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SOURCE CARDS ──────────────────────────────────────────────────────────────
export function SourceCards({ sources }: { sources: ScoredSource[] }) {
  if (!sources.length) return null;
  const supporting = sources.filter(s => s.stance==="supports");
  const opposing   = sources.filter(s => s.stance==="opposes");
  const neutral    = sources.filter(s => s.stance==="neutral");

  return (
    <div className="crystal-elevated result-reveal delay-300" style={{ padding:"20px 22px" }}>
      <div className="v-section-label">
        <span>Evidence sources</span>
        <span className="v-badge" style={{ marginLeft:"0", color:"var(--blue)", borderColor:"rgba(107,138,253,0.25)", background:"rgba(107,138,253,0.07)" }}>
          {sources.length}
        </span>
      </div>

      {supporting.length > 0 && <SourceGroup label="Supporting" sources={supporting} color="var(--v-true)" />}
      {opposing.length   > 0 && <SourceGroup label="Opposing"   sources={opposing}   color="var(--v-false)" />}
      {neutral.length    > 0 && <SourceGroup label="Context"    sources={neutral}     color="var(--v-mixed)" />}
    </div>
  );
}

function SourceGroup({ label, sources, color }: { label:string; sources:ScoredSource[]; color:string }) {
  return (
    <div className="vanta-tilt-soft" style={{ marginBottom:"16px" }}>
      <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", letterSpacing:"0.18em", textTransform:"uppercase", color, marginBottom:"8px" }}>
        {label} ({sources.length})
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
        {sources.map((s, i) => <SourceRow key={i} source={s} stanceColor={color} idx={i} />)}
      </div>
    </div>
  );
}

function SourceRow({ source, stanceColor, idx }: { source:ScoredSource; stanceColor:string; idx:number }) {
  const stars = Array.from({ length:5 }, (_, i) => i < source.credibility);
  const domain = source.domain || (source.url ? (() => { try { return new URL(source.url).hostname.replace("www.",""); } catch { return "source"; } })() : "source");
  const shared = {
    className: cn("source-card", `source-${source.stance}`, "evidence-reveal", "vanta-tilt-soft"),
    style: {
      animationDelay:`${idx*0.08}s`,
      background:"rgba(255,255,255,0.025)",
      border:"1px solid rgba(255,255,255,0.07)",
      padding:"12px 13px 12px 17px",
      cursor: source.url ? "pointer" : "default",
      textAlign: "left" as const,
      width: "100%",
      display: "block",
      textDecoration: "none",
      color: "inherit",
    },
  };

  const content = (
    <>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px", marginBottom:"5px" }}>
        <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"12px", fontWeight:500, color:"var(--pearl)", lineHeight:1.4, flex:1 }}>
          {source.title}
        </p>
        <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"8px", padding:"2px 7px", borderRadius:"20px", border:`1px solid ${stanceColor}40`, background:`${stanceColor}0f`, color:stanceColor, flexShrink:0, whiteSpace:"nowrap" }}>
          {source.stance==="supports"?"SUPPORTS":source.stance==="opposes"?"OPPOSES":"NEUTRAL"}
        </span>
      </div>
      <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", color:"rgba(245,241,234,0.30)", marginBottom:"5px" }}>
        {domain}{source.publishedAt && ` · ${new Date(source.publishedAt).toLocaleDateString("en-US",{month:"short",year:"numeric"})}`}
      </p>
      {source.snippet && (
        <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.48)", lineHeight:1.55, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
          {source.snippet}
        </p>
      )}
      <div style={{ display:"flex", gap:"2px", marginTop:"7px" }}>
        {stars.map((f,i) => (
          <span key={i} style={{ fontSize:"10px", color: f ? "var(--amber)" : "rgba(255,255,255,0.15)" }}>★</span>
        ))}
      </div>
    </>
  );

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        {...shared}
      >
        {content}
      </a>
    );
  }

  return <div {...shared}>{content}</div>;
}
