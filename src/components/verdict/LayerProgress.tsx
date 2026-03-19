// src/components/verdict/LayerProgress.tsx — Vanta Editorial
"use client";
import React from "react";
import { cn } from "@/components/ui/primitives";
export type LayerState = "idle"|"active"|"done"|"skipped"|"failed";
export interface Layer { id:string; icon:string; name:string; status:LayerState; message:string; barWidth:number; }

export function LayerProgress({ layers }: { layers: Layer[] }) {
  return (
    <div className="processing-slate animate-fade-up" style={{ padding: "0" }}>
      {/* Scan line — sweeps during active analysis */}
      <div className="scan-line-container">
        <div className="scan-line" />
      </div>

      <div style={{ padding: "18px 20px 16px", position:"relative", zIndex:1 }}>
        <div className="v-section-label" style={{ marginBottom:"14px" }}>
          <span>Intelligence layers</span>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {layers.map(layer => (
            <div key={layer.id} className={cn("layer-row-wrap", `layer-${layer.status}`)}
              style={{ display:"flex", alignItems:"center", gap:"12px" }}>

              {/* Icon node */}
              <div className={cn("layer-icon-node", `layer-${layer.status}`)}>
                <span style={{ fontSize:"14px", lineHeight:1 }}>{layer.icon}</span>
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"3px" }}>
                  <span style={{ fontFamily:"var(--font-sans),system-ui,sans-serif", fontSize:"13px", fontWeight:500, color:"var(--pearl)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {layer.name}
                  </span>
                  {layer.status==="done"   && <span style={{ color:"rgba(110,231,160,0.8)", fontSize:"13px", flexShrink:0, marginLeft:"8px" }}>✓</span>}
                  {layer.status==="failed" && <span style={{ color:"rgba(244,185,97,0.85)", fontSize:"13px", flexShrink:0, marginLeft:"8px" }}>↺</span>}
                  {layer.status==="skipped" && <span style={{ color:"rgba(245,241,234,0.25)", fontSize:"13px", flexShrink:0, marginLeft:"8px" }}>•</span>}
                </div>
                <p style={{ fontFamily:"var(--font-mono),monospace", fontSize:"10px", color: layer.status==="active"?"var(--blue)":layer.status==="done"?"rgba(110,231,160,0.6)":layer.status==="failed"?"rgba(244,185,97,0.62)":"rgba(245,241,234,0.28)", letterSpacing:"0.03em", margin:0 }}>
                  {layer.message}
                  {layer.status==="active" && (
                    <span className="proc-dots" style={{ marginLeft:"6px" }}>
                      <span/><span/><span/>
                    </span>
                  )}
                </p>
                {(layer.status==="active"||layer.status==="done"||layer.status==="failed") && (
                  <div className="layer-bar-track" style={{ marginTop:"6px" }}>
                    <div className={cn("layer-bar-fill", `layer-${layer.status}`)} style={{ width:`${layer.barWidth}%` }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
