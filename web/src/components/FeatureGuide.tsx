"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { GUIDE, searchGuide, tipsForPath, type GuideEntry } from "@/lib/ai/feature-guide";

const SUGGESTIONS = [
  "How do I get an airline-wise report?",
  "What is the lead score?",
  "Why are some charges pre-filled?",
  "What does Lowest mean?",
];

function GuideCard({ entry, onNavigate, defaultOpen }: { entry: GuideEntry; onNavigate: () => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white/80">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="block text-xs font-extrabold text-[var(--color-atlas-navy)]">{entry.title}</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {entry.where}
          </span>
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[var(--color-border)] px-3 py-2.5 text-xs leading-relaxed">
          <p>{entry.summary}</p>
          <ol className="list-decimal space-y-1 pl-4">
            {entry.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {entry.href ? (
            <Link href={entry.href} onClick={onNavigate} className="inline-block font-bold text-sky-800 underline">
              Take me there
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Vertex Guide — explains the features in the app; answers typed questions from the built-in guide (offline). */
export function FeatureGuide({
  pathname,
  initialQuery = "",
  onNavigate,
}: {
  pathname: string;
  initialQuery?: string;
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const hits = searchGuide(query, pathname);
  const tips = tipsForPath(pathname);
  const asked = query.trim().length > 0;

  return (
    <div className="space-y-2" data-testid="feature-guide">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        <Sparkles className="h-3 w-3" />
        Vertex Guide — what does each feature do?
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask e.g. “how do I export a POL-wise report?”"
        aria-label="Ask the Vertex Guide"
        className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs"
      />

      {asked ? (
        hits.length ? (
          <div className="space-y-2">
            {hits.map((h, i) => (
              <GuideCard key={h.entry.id} entry={h.entry} onNavigate={onNavigate} defaultOpen={i === 0} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">
            <p className="flex items-center gap-1 font-semibold">
              <HelpCircle className="h-3.5 w-3.5" /> No guide entry matches that.
            </p>
            <p className="mt-1">Try a feature word (report, lead, forecast, WhatsApp, autofill) or:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--color-atlas-navy)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            On this screen
          </div>
          <div className="space-y-2">
            {tips.slice(0, 4).map((e) => (
              <GuideCard key={e.id} entry={e} onNavigate={onNavigate} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-full border border-[var(--color-border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--color-atlas-navy)]"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)]">{GUIDE.length} features covered · answers come from the built-in guide, nothing leaves your browser.</p>
        </>
      )}
    </div>
  );
}
