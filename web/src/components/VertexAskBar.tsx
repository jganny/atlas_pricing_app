"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { SwipeDeleteRow } from "@/components/SwipeDeleteRow";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { newQuoteHref, parseDeskIntent } from "@/lib/ai/desk-intent";
import { enquiryHref, searchQuotes } from "@/lib/quotes/find-quotes";
import {
  hideQuoteFromAsk,
  listHiddenQuoteIds,
  subscribeHiddenAsk,
} from "@/lib/quotes/hidden-ask";
import { cn } from "@/lib/utils";

const HELP: Record<string, string> = {
  "": "Try: find Zenith, Maersk last week, quote air BLR to LHR, or overdue.",
  offline:
    "Offline backups are a safety net on this computer: if save or the network hiccups, Vertex keeps the last quotes you saved here so you can reopen them without the file name. They are not a second database — Enquiry DB is the source of truth.",
  performance:
    "Desk performance lists everyone who actually has quotes in the selected period, plus known desks. Monthly hides older months. Switch to All time to see every officer in the workspace.",
};

export function VertexAskBar({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { data: rows = [] } = useEnquiries();
  const [value, setValue] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setHiddenIds(listHiddenQuoteIds());
    refresh();
    return subscribeHiddenAsk(refresh);
  }, []);

  const hits = useMemo(() => {
    const intent = parseDeskIntent(value);
    if (intent.kind !== "find") return [];
    const hidden = new Set(hiddenIds);
    return searchQuotes(rows, intent.query, 12).filter((row) => !hidden.has(row.id));
  }, [value, rows, hiddenIds]);

  function go(href: string) {
    onNavigate?.();
    router.push(href);
  }

  function run() {
    const intent = parseDeskIntent(value);
    if (intent.kind === "goto") {
      setNote(intent.label);
      go(intent.href);
      return;
    }
    if (intent.kind === "new") {
      setNote(`Opening ${intent.mode} desk`);
      go(newQuoteHref(intent));
      return;
    }
    if (intent.kind === "help") {
      setNote(HELP[intent.topic] || HELP[""]);
      return;
    }
    if (hits[0]) {
      go(enquiryHref(hits[0]));
      return;
    }
    setNote(
      value.trim().length < 2
        ? HELP[""]
        : "No match yet — try the customer, city, carrier, or a few letters of the quote number. File name not required.",
    );
  }

  return (
    <div className={cn("space-y-2", compact ? "" : "atlas-panel rounded-xl p-3 md:p-4")}>
      {!compact ? (
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          Ask Vertex
        </div>
      ) : null}
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            data-testid="vertex-ask"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="atlas-vertex-ask"
            enterKeyHint="search"
            className="w-full rounded-lg border border-[var(--color-border)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400"
            placeholder="Find a quote (customer or city — no file name) · or quote air BLR to LHR"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setNote(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-lg bg-[var(--color-atlas-navy)] px-3 py-2 text-sm font-bold text-white hover:bg-[#14154a]"
          onClick={run}
        >
          Go
        </button>
      </div>
      {hits.length > 0 ? (
        <ul
          data-testid="vertex-ask-hits"
          className="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-white text-sm"
        >
          {hits.slice(0, 8).map((row) => (
            <li key={row.id}>
              <SwipeDeleteRow
                deleteLabel="Delete"
                onDelete={() => hideQuoteFromAsk(row.id)}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 pr-16 text-left hover:bg-sky-50/70"
                  onClick={() => go(enquiryHref(row))}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--color-atlas-navy)]">
                      {row.customer || row.ref}
                    </span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">
                      {row.ref} · {row.origin}→{row.destination}
                      {row.carrier ? ` · ${row.carrier}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                    {row.status}
                  </span>
                </button>
              </SwipeDeleteRow>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{note}</p> : null}
      {!compact && !value ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          You do not need the file name. Type the customer, port, or airline — Vertex opens the
          quote. Swipe a row left (or hover Delete) to hide it from this list. ⌘K does the same from
          any screen.
        </p>
      ) : null}
    </div>
  );
}
