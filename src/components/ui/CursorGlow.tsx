// src/components/ui/CursorGlow.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const finePointer = !media.matches && !coarse.matches && window.innerWidth >= 960;
    setEnabled(finePointer);
    if (!finePointer) return;

    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    let visible = false;

    const update = () => {
      if (!el) return;
      el.style.setProperty("--cx", `${lastX}px`);
      el.style.setProperty("--cy", `${lastY}px`);
      raf = 0;
    };

    const onMove = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!visible) {
        el.classList.add("is-ready");
        visible = true;
      }
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  if (!enabled) return null;

  return <div ref={ref} className="cursor-glow" aria-hidden="true" />;
}
