"use client";

import { useEffect } from "react";

export function AmbientScene() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.innerWidth < 960;

    if (reduceMotion || coarse || narrow) {
      document.documentElement.classList.add("truthlens-static-scene");
      return;
    }

    const root = document.documentElement;
    let raf = 0;

    const setVars = (x: number, y: number) => {
      root.style.setProperty("--scene-x", `${x.toFixed(2)}px`);
      root.style.setProperty("--scene-y", `${y.toFixed(2)}px`);
      root.style.setProperty("--scene-rx", `${(-x / 2).toFixed(2)}deg`);
      root.style.setProperty("--scene-ry", `${(y / 2).toFixed(2)}deg`);
    };

    const onMove = (event: PointerEvent) => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      const targetX = nx * 26;
      const targetY = ny * 20;
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => setVars(targetX, targetY));
    };

    const onLeave = () => setVars(0, 0);

    root.classList.add("truthlens-scene-ready");
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      root.classList.remove("truthlens-scene-ready");
      root.style.removeProperty("--scene-x");
      root.style.removeProperty("--scene-y");
      root.style.removeProperty("--scene-rx");
      root.style.removeProperty("--scene-ry");
    };
  }, []);

  return (
    <div className="ambient-scene" aria-hidden="true">
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
      <div className="ambient-orb ambient-orb-c" />
      <div className="ambient-grid" />
      <div className="ambient-horizon" />
      <div className="ambient-veil" />
    </div>
  );
}
