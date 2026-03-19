// src/components/history/HistoryPanel.tsx — Vanta Editorial
"use client";
import React, { useEffect, useState, useCallback } from "react";
import type { HistoryItem, Verdict } from "@/types";

const VS: Record<Verdict,{color:string;bg:string;border:string}> = {
  TRUE:       {color:"var(--v-true)",      bg:"rgba(110,231,160,0.07)",  border:"rgba(110,231,160,0.22)"},
  FALSE:      {color:"var(--v-false)",     bg:"rgba(248,113,113,0.07)",  border:"rgba(248,113,113,0.22)"},
  MIXED:      {color:"var(--v-mixed)",     bg:"rgba(244,185, 97,0.07)",  border:"rgba(244,185, 97,0.22)"},
  UNVERIFIED: {color:"var(--v-unverified)",bg:"rgba(148,163,184,0.07)",  border:"rgba(148,163,184,0.18)"},
};

interface Props { onSelect:(claim:string)=>void; refreshTrigger?:number; }

export function HistoryPanel({ onSelect, refreshTrigger=0 }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/history");
      const j = await r.json() as { ok:boolean; data?:HistoryItem[] };
      if (j.ok && j.data) setItems(j.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_, refreshTrigger]);

  const rel = (iso:string) => {
    const d = (Date.now()-new Date(iso).getTime())/1000;
    if (d<60) return "just now";
    if (d<3600) return `${Math.round(d/60)}m ago`;
    if (d<86400) return `${Math.round(d/3600)}h ago`;
    return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
  };

  return (
    <div className="crystal vanta-tilt-soft" style={{ padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
        <div className="v-section-label" style={{ margin:0, flex:1 }}><span>Recent checks</span></div>
        <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"9px", letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(245,241,234,0.25)" }}>
          Tap to re-run
        </span>
      </div>

      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"8px" }}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:"64px", borderRadius:"10px" }} />)}
        </div>
      ) : items.length === 0 ? (
        <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"11px", color:"rgba(245,241,234,0.25)", padding:"8px 0" }}>
          No checks yet. Start by entering a claim above.
        </p>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"8px" }}>
          {items.map(item => {
            const s = VS[item.verdict as Verdict] ?? VS.UNVERIFIED;
            return (
              <button key={item.id} onClick={()=>onSelect(item.claimPreview)}
                className="crystal-hover"
                style={{
                  textAlign:"left", background:"rgba(255,255,255,0.022)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:"10px", padding:"11px 13px", cursor:"pointer",
                }}>
                <p style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"11px", color:"rgba(245,241,234,0.60)", lineHeight:1.45, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:"7px" }}>
                  {item.claimPreview}
                </p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"8px", fontWeight:700, letterSpacing:"0.10em", padding:"2px 7px", borderRadius:"20px", border:`1px solid ${s.border}`, background:s.bg, color:s.color }}>
                    {item.verdict}
                  </span>
                  <span style={{ fontFamily:"var(--font-mono),monospace", fontSize:"8px", color:"rgba(245,241,234,0.22)" }}>
                    {rel(item.createdAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
