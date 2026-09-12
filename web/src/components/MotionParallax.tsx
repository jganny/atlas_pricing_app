"use client";

import { useEffect, useRef, useState } from "react";

/** Layers move at different speeds while you scroll — that is parallax. */
export function MotionParallax() {
  const root = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    function onScroll() {
      const el = root.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setY(-rect.top);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={root}
      data-testid="parallax-stage"
      className="relative h-[34rem] overflow-hidden rounded-2xl border border-[var(--color-border)]"
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#b9d4e8] via-[#8ebdd0] to-[#3d6f86]"
        style={{ transform: `translateY(${y * 0.08}px)` }}
      />
      <div
        className="absolute -left-8 bottom-8 h-40 w-[70%] rounded-[40%] bg-[#2f5d6e]/50 blur-[1px]"
        style={{ transform: `translateY(${y * 0.22}px)` }}
      />
      <div
        className="absolute right-6 top-16 h-16 w-48 rounded-lg bg-[#8b929c] shadow-xl"
        style={{ transform: `translate(${y * 0.12}px, ${y * -0.18}px) rotate(-8deg)` }}
        aria-hidden
      />
      <p className="absolute bottom-4 left-4 z-10 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-[var(--color-atlas-navy)] shadow">
        Sky is slow. The craft is faster. Ocean is fastest. That is parallax.
      </p>
    </div>
  );
}
