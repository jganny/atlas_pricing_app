"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { VertexEmblem } from "@/components/VertexEmblem";
import { TOUR_STEPS, clockLabel, tourSeconds } from "@/lib/tour-steps";
import { cn } from "@/lib/utils";

/** A "Take the tour" link that opens the tour in a window. Captions on screen; reading aloud is optional. */
export function TourLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} data-testid="tour-link">
        Take the tour
      </button>
      {open ? <GuidedTour onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GuidedTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  // Auto-play: move on once a step's reading time has passed.
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing]);

  const [lastIndex, setLastIndex] = useState(index);
  if (lastIndex !== index) {
    setLastIndex(index);
    setElapsed(0);
  }
  if (playing && elapsed >= step.seconds) {
    if (last) {
      setPlaying(false);
      setElapsed(0);
    } else {
      setIndex(index + 1);
    }
  }

  // Optional voice: reads the caption of the step on screen.
  useEffect(() => {
    if (!voice || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(step.caption);
    u.lang = "en-IN";
    window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [voice, step.caption]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="dialog" aria-label="Take the tour" data-testid="tour">
      <button type="button" aria-label="Close the tour" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-[var(--color-text)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <VertexEmblem size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Take the tour</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Step {index + 1} of {TOUR_STEPS.length} · about {clockLabel(tourSeconds())} in all
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-0 overflow-y-auto md:grid-cols-[1fr_13rem]">
          <div className="space-y-4 p-4">
            <style>{`
              @keyframes tour-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(14,165,233,.0); } 50% { box-shadow: 0 0 0 6px rgba(14,165,233,.28); } }
              @keyframes tour-cursor { 0% { transform: translate(-40px, 26px); opacity: 0; } 30% { opacity: 1; } 70%,100% { transform: translate(0, 0); opacity: 1; } }
              .tour-lit { animation: tour-glow 1.8s ease-in-out infinite; }
              .tour-cursor { animation: tour-cursor 2.4s ease-out infinite; }
              @media (prefers-reduced-motion: reduce) { .tour-lit, .tour-cursor { animation: none; } }
            `}</style>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3" aria-hidden="true" key={step.id}>
              {step.blocks.map((b, i) => (
                <div
                  key={b.label}
                  className={cn(
                    "relative flex min-h-[7rem] flex-col justify-end rounded-lg border bg-white p-3",
                    i === step.focus ? "tour-lit border-sky-500" : "border-[var(--color-border)] opacity-70",
                  )}
                >
                  <div className="mb-auto h-2 w-2/3 rounded bg-slate-200" />
                  <div className="mt-2 h-2 w-1/2 rounded bg-slate-100" />
                  <div className="mt-3 text-sm font-bold text-[var(--color-atlas-navy)]">{b.label}</div>
                  {b.sub ? <div className="text-xs text-[var(--color-text-muted)]">{b.sub}</div> : null}
                  {i === step.focus ? <span className="tour-cursor pointer-events-none absolute right-3 top-3 text-lg">☝</span> : null}
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed" data-testid="tour-caption">
                {step.caption}
              </p>
            </div>
          </div>

          <ol className="space-y-1 border-t border-[var(--color-border)] bg-slate-50/60 p-3 text-sm md:border-l md:border-t-0">
            {TOUR_STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", i === index ? "bg-white font-bold shadow-sm ring-1 ring-sky-300" : "hover:bg-white")}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {i + 1}. {s.title}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">{clockLabel(s.seconds)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold disabled:opacity-40" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-atlas-navy)] px-3 py-1.5 text-sm font-bold text-white" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? "Finish" : "Next"} {last ? null : <ChevronRight className="h-4 w-4" />}
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? "Pause" : "Play all"}
          </button>
          <button type="button" aria-pressed={voice} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold" onClick={() => setVoice((v) => !v)}>
            {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Read aloud: {voice ? "on" : "off"}
          </button>
        </div>
      </div>
    </div>
  );
}
