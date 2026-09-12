"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui";
import { MotionParallax } from "@/components/MotionParallax";

const CraftCanvas = dynamic(
  () => import("@/components/three/CraftCanvas").then((m) => m.CraftCanvas),
  { ssr: false, loading: () => <div className="h-[22rem] rounded-2xl bg-[var(--color-surface-muted)]" /> },
);

export default function MotionSamplePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Sample — not a desk
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-atlas-navy)]">
          Three ways the page can move
        </h1>
        <p className="max-w-xl text-sm text-[var(--color-text-muted)]">
          These are three different tools. Scroll this page and tap the buttons. Desks (Air / Sea)
          stay still so you can type.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="#smooth">
            <Button type="button">1. Smooth scroll</Button>
          </a>
          <a href="#parallax">
            <Button type="button" variant="secondary">
              2. Parallax
            </Button>
          </a>
          <a href="#three">
            <Button type="button" variant="secondary">
              3. Three.js
            </Button>
          </a>
        </div>
      </header>

      <section id="smooth" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">1. Smooth scrolling</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          The page eases to the next section instead of jumping. No 3D engine. It is just the
          scrollbar being polite.
        </p>
        <div className="h-28 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm font-semibold text-[var(--color-atlas-navy)]">
          You arrived here by easing, not by a 3D world.
        </div>
      </section>

      <section id="parallax" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">2. Parallax</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Still 2D pictures. The background, the craft, and the water move at different speeds while
          you scroll — like looking out a car window.
        </p>
        <MotionParallax />
      </section>

      <section id="three" className="scroll-mt-24 space-y-3 pb-8">
        <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">3. Three.js</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          A real 3D object (WebGL). Drag to spin. This is the same toolkit we would use for the Quote
          hub aircraft. Babylon.js does the same job — we should pick <strong>one</strong>. For this
          React app, Three.js is the fit.
        </p>
        <CraftCanvas />
      </section>
    </div>
  );
}
