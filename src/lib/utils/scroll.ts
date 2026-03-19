// src/lib/utils/scroll.ts
// Frontend scroll helpers with Lenis fallback.
// Keeps native behavior as a safe fallback and respects reduced-motion users.

type LenisLike = {
  scrollTo: (target: number | Element, options?: { immediate?: boolean; offset?: number; duration?: number }) => void;
};

type TruthLensWindow = Window & {
  __truthlensLenis?: LenisLike;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getLenis(): LenisLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as TruthLensWindow).__truthlensLenis;
}

export function smoothScrollToTop(): void {
  if (typeof window === "undefined") return;
  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(0, { immediate: false });
    return;
  }
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function smoothScrollToElement(target: Element | null, offset = 0): void {
  if (typeof window === "undefined" || !target) return;
  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(target, { offset, immediate: false });
    return;
  }
  const rect = target.getBoundingClientRect();
  const top = window.scrollY + rect.top + offset;
  window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
