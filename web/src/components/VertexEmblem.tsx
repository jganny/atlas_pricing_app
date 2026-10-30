"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The Ask Vertex emblem: Vishnu's Three Strides (Trivikrama) — three arcs rising from one glowing point: earth, sky,
 * heaven. Drawn as stacked layers at slightly different depths so it has real 3D parallax: it floats and tilts gently
 * on its own, the arcs light up one after another (one stride at a time), and when `follow` is set it leans toward the
 * pointer. All motion stops for people who ask their device for reduced motion (see globals.css, `.vx-*`).
 */
const NIGHT = "#0b1030";

function Layer({ depth, children, label }: { depth: number; children: React.ReactNode; label?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className="vx-layer"
      style={{ ["--vx-z" as string]: depth }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

export function VertexEmblem({ size = 48, follow = false, className }: { size?: number; follow?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // One gradient id per emblem, so a hidden copy (the closed Vertex panel) can never be the one the others point at.
  const night = `vx-night-${useId().replace(/:/g, "")}`;

  function lean(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.setProperty("--vx-ry", `${(x * 22).toFixed(1)}deg`);
    el.style.setProperty("--vx-rx", `${(-y * 22).toFixed(1)}deg`);
  }
  function settle() {
    ref.current?.style.removeProperty("--vx-ry");
    ref.current?.style.removeProperty("--vx-rx");
  }

  return (
    <span
      ref={ref}
      className={cn("vx-scene", className)}
      style={{ ["--vx-size" as string]: `${size}px`, width: size, height: size }}
      onPointerMove={follow ? lean : undefined}
      onPointerLeave={follow ? settle : undefined}
      role="img"
      aria-label="Vertex"
    >
      <span className="vx-follow">
        <span className="vx-tilt">
          <Layer depth={0}>
            <defs>
              <radialGradient id={night} cx="50%" cy="38%" r="78%">
                <stop offset="0" stopColor="#202c6e" />
                <stop offset="1" stopColor={NIGHT} />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill={`url(#${night})`} />
            <circle cx="60" cy="60" r="57" fill="none" stroke="#f6c75a" strokeOpacity=".55" strokeWidth="1.2" />
            <line x1="16" y1="96" x2="104" y2="96" stroke="#3fd0c9" strokeOpacity=".35" strokeWidth="1" />
          </Layer>
          <Layer depth={1}>
            <path className="vx-arc vx-arc-1" d="M18 92 A42 42 0 0 1 102 92" fill="none" stroke="#3fd0c9" strokeWidth="4" strokeLinecap="round" />
          </Layer>
          <Layer depth={2}>
            <path className="vx-arc vx-arc-2" d="M30 92 A30 30 0 0 1 90 92" fill="none" stroke="#e9eefc" strokeWidth="4" strokeLinecap="round" />
          </Layer>
          <Layer depth={3}>
            <path className="vx-arc vx-arc-3" d="M42 92 A18 18 0 0 1 78 92" fill="none" stroke="#f6c75a" strokeWidth="4" strokeLinecap="round" />
          </Layer>
          <Layer depth={4}>
            <circle className="vx-glow" cx="60" cy="92" r="11" fill="#ff9a3c" opacity=".4" />
            <circle cx="60" cy="92" r="4.6" fill="#ff9a3c" />
            <circle cx="60" cy="92" r="2" fill="#fff4dc" />
          </Layer>
        </span>
      </span>
    </span>
  );
}
