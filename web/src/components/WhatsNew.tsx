"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { appVersion } from "@/lib/env";
import { RELEASE_NOTES, baseVersion, notesFor, type ReleaseNote } from "@/lib/release-notes";

function Notes({ notes }: { notes: ReleaseNote }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {notes.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** The changes in the version that just arrived — a collapsed list inside the update banner. */
export function WhatsNewInline() {
  const notes = notesFor(appVersion);
  if (!notes) return null;
  return (
    <details className="basis-full rounded-md bg-white/70 px-3 py-2" data-testid="whats-new-inline">
      <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wide">
        What’s new in v{notes.version} ({notes.items.length})
      </summary>
      <div className="mt-2">
        <Notes notes={notes} />
      </div>
    </details>
  );
}

/** A small link that opens the recent release notes — for anyone who wants to look back. */
export function WhatsNewLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} data-testid="whats-new-link">
        What’s new
      </button>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-label="What’s new">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 text-[var(--color-text)] shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--color-atlas-navy)]">
                <Sparkles className="h-4 w-4" /> What’s new · you are on v{baseVersion(appVersion)}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              {RELEASE_NOTES.map((n) => (
                <section key={n.version}>
                  <div className="mb-1 text-xs font-bold text-[var(--color-text-muted)]">
                    v{n.version} · {n.date}
                  </div>
                  <Notes notes={n} />
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
