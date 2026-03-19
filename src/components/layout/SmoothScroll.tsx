// src/components/layout/SmoothScroll.tsx
"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __truthlensLenis?: {
      scrollTo: (target: number | Element, options?: { immediate?: boolean; offset?: number; duration?: number }) => void;
      destroy?: () => void;
      raf?: (time: number) => void;
    };
  }
}

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const narrowViewport = window.innerWidth < 960;

    // Keep mobile / reduced-motion native to avoid input lag and jank.
    if (reducedMotion || coarsePointer || narrowViewport) {
      document.documentElement.classList.remove("lenis-active");
      document.documentElement.removeAttribute("data-lenis");
      return;
    }

    let rafId = 0;
    let alive = true;

    (async () => {
      const mod = await import("lenis");
      if (!alive) return;

      const Lenis = mod.default;
      const lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 0.85,
        touchMultiplier: 1,
      });

      window.__truthlensLenis = lenis;
      document.documentElement.classList.add("lenis-active");
      document.documentElement.dataset.lenis = "true";

      const loop = (time: number) => {
        lenis.raf(time);
        rafId = window.requestAnimationFrame(loop);
      };

      rafId = window.requestAnimationFrame(loop);
    })().catch(() => {
      // Fallback remains native; no-op.
    });

    return () => {
      alive = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.__truthlensLenis?.destroy?.();
      delete window.__truthlensLenis;
      document.documentElement.classList.remove("lenis-active");
      document.documentElement.removeAttribute("data-lenis");
    };
  }, []);

  return null;
}
