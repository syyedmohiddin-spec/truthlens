// src/components/verdict/IntelligenceBreakdown.tsx — Vanta Editorial
"use client";
import React, { useEffect, useRef } from "react";
import type { RadarScores, WikiContext, FactCheckResult } from "@/types";

export function RadarChart({ scores }: { scores: RadarScores }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let chart: import("chart.js").Chart | null = null;
    let cancelled = false;
    (async () => {
      const { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler } = await import("chart.js");
      Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler);
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: "radar",
        data: {
          labels: ["Accuracy","Diversity","Consensus","Recency","Verifiability"],
          datasets: [{
            data: [scores.accuracy,scores.diversity,scores.consensus,scores.recency,scores.verifiability],
            backgroundColor: "rgba(107,138,253,0.07)",
            borderColor: "rgba(107,138,253,0.55)",
            borderWidth: 1.5,
            pointBackgroundColor: ["#6ee7a0","#6B8AFD","var(--v-mixed)","#F4B961","#f87171"].map(c=>c),
            pointBorderColor: "transparent", pointRadius: 4, pointHoverRadius: 6,
          }],
        },
        options: {
          responsive:true, maintainAspectRatio:false,
          animation:{ duration:900, easing:"easeOutQuart" },
          plugins:{ legend:{ display:false } },
          scales:{ r:{
            min:0, max:100,
            ticks:{ display:false },
            grid:{ color:"rgba(255,255,255,0.055)" },
            angleLines:{ color:"rgba(255,255,255,0.055)" },
            pointLabels:{ color:"rgba(245,241,234,0.40)", font:{ family:"var(--font-mono)",size:9 } },
          }},
        },
      });
    })();
    return () => { cancelled=true; chart?.destroy(); };
  }, [scores]);

  const items = [
    ["Accuracy",      scores.accuracy,      "#6ee7a0"],
    ["Diversity",     scores.diversity,      "var(--blue)"],
    ["Consensus",     scores.consensus,      "var(--v-mixed)"],
    ["Recency",       scores.recency,        "var(--amber)"],
    ["Verifiability", scores.verifiability,  "var(--v-false)"],
  ] as [string,number,string][];

  return (
    <div className="crystal-elevated result-reveal delay-400 vanta-tilt-soft" style={{ padding:"20px 22px" }}>
      <div className="v-section-label"><span>Intelligence breakdown</span></div>
      <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:"20px", alignItems:"center" }}>
        <div style={{ height:"180px", position:"relative" }}><canvas ref={canvasRef} /></div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {items.map(([label,val,col]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:"9px" }}>
              <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:col, flexShrink:0 }} />
              <span style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.55)", flex:1 }}>{label}</span>
              <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"11px", fontWeight:600, color:col }}>{val}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WikiContextPanel({ wiki }: { wiki: WikiContext }) {
  return (
    <div className="crystal result-reveal delay-200 vanta-tilt-soft" style={{ padding:"16px 18px" }}>
      <div className="v-section-label"><span>Wikipedia context</span></div>
      <div style={{ display:"flex", gap:"13px", alignItems:"flex-start" }}>
        {wiki.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wiki.thumbnailUrl} alt={wiki.title}
            style={{ width:"64px", height:"64px", borderRadius:"8px", objectFit:"cover", border:"1px solid rgba(255,255,255,0.08)", flexShrink:0 }} />
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"6px" }}>
            <h3 style={{ fontFamily:"var(--font-serif),Georgia,serif", fontSize:"14px", fontWeight:700, color:"var(--pearl)" }}>{wiki.title}</h3>
            <span className="v-badge" style={{ fontSize:"8px", color:"var(--blue)", borderColor:"rgba(107,138,253,0.25)", background:"rgba(107,138,253,0.07)" }}>Wikipedia</span>
          </div>
          <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.55)", lineHeight:1.65, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:"7px" }}>
            {wiki.extract}
          </p>
          <a href={wiki.url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", letterSpacing:"0.10em", color:"rgba(107,138,253,0.65)", display:"inline-flex", alignItems:"center", gap:"4px" }}>
            Read full article →
          </a>
        </div>
      </div>
    </div>
  );
}

export function FactCheckPanel({ factChecks }: { factChecks: FactCheckResult[] }) {
  if (!factChecks.length) return null;
  return (
    <div className="crystal result-reveal delay-300 vanta-tilt-soft" style={{ padding:"16px 18px" }}>
      <div className="v-section-label"><span>Google fact check database</span></div>
      <div style={{ display:"flex", flexDirection:"column", gap:"0" }}>
        {factChecks.slice(0,4).map((fc, i) => {
          const r = fc.rating.toLowerCase();
          const col = r.includes("false")||r.includes("mislead") ? "var(--v-false)" : r.includes("true")||r.includes("accurate") ? "var(--v-true)" : "var(--v-mixed)";
          return (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"9px 0", borderBottom: i < factChecks.length-1 ? "1px solid rgba(255,255,255,0.055)" : "none" }}>
              <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", fontWeight:700, padding:"2px 8px", borderRadius:"20px", border:`1px solid ${col}44`, background:`${col}0f`, color:col, flexShrink:0, whiteSpace:"nowrap" }}>
                {fc.rating}
              </span>
              <div>
                <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.55)", lineHeight:1.55, marginBottom:"3px" }}>
                  {fc.claimText.slice(0,120)}{fc.claimText.length>120?"…":""}
                </p>
                <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", color:"rgba(245,241,234,0.28)" }}>
                  {fc.publisher}{fc.reviewDate && ` · ${new Date(fc.reviewDate).toLocaleDateString("en-US",{month:"short",year:"numeric"})}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
