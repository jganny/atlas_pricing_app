"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, CornerDownRight, FileText, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { newQuoteHref, parseDeskIntent } from "@/lib/ai/desk-intent";
import { askPrefill } from "@/lib/hub/ask-instruction";
import { storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { searchQuotes } from "@/lib/quotes/find-quotes";
import { listHiddenQuoteIds, subscribeHiddenAsk } from "@/lib/quotes/hidden-ask";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { visibleSections } from "@/lib/admin/sections";
import { findQuotesAnywhere } from "@/lib/firebase/archive-lookup";
import { buildGroups, flatten, moveActive, type SearchKind, type SearchRow } from "@/lib/search/global-search";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<SearchKind, typeof FileText> = {
  quote: FileText,
  customer: Building2,
  setting: SlidersHorizontal,
  page: CornerDownRight,
  start: Sparkles,
};

/** The typed words, once typing has paused: older quotes are looked up only then, not on every key. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * The magnifier in the top bar. Click it (or press /) and it opens; type to find a quote, a customer or, for administrators, a setting;
 * or type a quote request ("quote air BLR to DXB 120 kg") and the last row starts it. It closes again when a result is picked,
 * when you click away, or on Esc. `variant` is the desktop bar or the phone bar; the phone one opens across the whole bar.
 */
export function GlobalSearch({ variant }: { variant: "desk" | "phone" }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: rows = [] } = useEnquiries();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => listHiddenQuoteIds());
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeHiddenAsk(() => setHiddenIds(listHiddenQuoteIds())), []);

  const isAdmin = isAdminUser(user?.username, user?.role);
  const isGanny = user?.username?.toLowerCase() === "ganny";
  const sections = useMemo(() => (isAdmin ? visibleSections({ isAdmin, isGanny, live: useLiveData }) : []), [isAdmin, isGanny]);

  const intent = useMemo(() => parseDeskIntent(value), [value]);
  const quotes = useMemo(() => (open && intent.kind === "find" ? searchQuotes(rows, intent.query, 12) : []), [open, intent, rows]);

  // Quotes older than the ones already on screen: looked up after a short pause, and only in the live app.
  const pause = useDebounced(value.trim(), 350);
  const older = useQuery({
    queryKey: ["globalSearchOlder", pause],
    queryFn: () => findQuotesAnywhere(pause, new Set(rows.map((r) => r.id)), 6),
    enabled: open && useLiveData && pause.length >= 3 && parseDeskIntent(pause).kind === "find",
    staleTime: 60_000,
    retry: 0,
  });

  const groups = useMemo(
    () => buildGroups({ query: value, intent, quotes, older: older.data ?? [], hiddenIds: new Set(hiddenIds), allRows: rows, sections }),
    [value, intent, quotes, older.data, hiddenIds, rows, sections],
  );
  const flat = useMemo(() => flatten(groups), [groups]);
  const current = flat.length ? Math.min(active, flat.length - 1) : -1;

  function close() {
    setOpen(false);
    setValue("");
    setActive(0);
  }

  function pick(row: SearchRow) {
    const typed = value;
    close();
    input.current?.blur();
    if (row.kind === "start") {
      const it = parseDeskIntent(typed);
      if (it.kind === "new") {
        // The same hand-over the old Start here bar made: the desk opens already filled and applies the instruction.
        const prefill = askPrefill(typed, it);
        if (prefill) {
          storeSmartQuotePrefill(prefill);
          router.push(`/${it.mode}?smart=1`);
          return;
        }
        router.push(newQuoteHref(it));
        return;
      }
    }
    router.push(row.href);
  }

  // Focus the box as soon as it opens.
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // "/" opens it from anywhere, but not while typing in a box, and not on the Admin page, which has its own search for settings.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.getElementById("admin-search")) return;
      if (!root.current || root.current.getClientRects().length === 0) return; // the other bar (phone or desktop) is the visible one
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(moveActive(current, 1, flat.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(moveActive(current, -1, flat.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[current]) pick(flat[current]);
    } else if (e.key === "Escape" && open) {
      // Close the search only; Esc with it already closed still leaves the page as everywhere else in the app.
      e.preventDefault();
      close();
      input.current?.blur();
    }
  }

  const typed = value.trim();
  const listId = `global-search-results-${variant}`;
  const showPanel = open;

  const panel = showPanel ? (
    <div
      id={listId}
      role="listbox"
      aria-label="Search results"
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "z-[80] overflow-auto rounded-2xl border border-[var(--color-border)] bg-white p-2 text-[var(--color-text)] shadow-xl",
        variant === "desk" ? "absolute right-0 top-[calc(100%+8px)] max-h-[70vh] w-[min(440px,92vw)]" : "fixed inset-x-3 top-[60px] max-h-[calc(100dvh-84px)]",
      )}
    >
      {typed.length < 2 ? (
        <div className="px-3 py-3 text-sm text-[var(--color-text-muted)]">
          <p>Type a customer, quote number, city or setting.</p>
          <p className="mt-1 text-xs">Or a request: quote air BLR to DXB 120 kg</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">
          {older.isFetching ? "Looking through older quotes…" : <>Nothing matches &ldquo;{typed}&rdquo;. Try a customer, a city, a quote number, or a few letters.</>}
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</div>
            {g.items.map((row) => {
              const i = flat.indexOf(row);
              const Icon = KIND_ICON[row.kind];
              const on = i === current;
              return (
                <button
                  key={row.key}
                  id={`${listId}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-testid="global-search-hit"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(row)}
                  className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left", on ? "bg-slate-50" : "")}
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", on ? "bg-[var(--color-atlas-navy)] text-white" : "bg-[var(--color-atlas-gold-soft)] text-[var(--color-atlas-sky)]")}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{row.title}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{row.sub}</span>
                  </span>
                  {row.meta ? <span className="shrink-0 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">{row.meta}</span> : null}
                </button>
              );
            })}
          </div>
        ))
      )}
      {typed.length >= 2 && older.isFetching && groups.length > 0 ? <p className="px-3 pb-1 pt-2 text-xs text-slate-400">Looking through older quotes…</p> : null}
    </div>
  ) : null;

  const field = (
    <input
      ref={input}
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && current >= 0 ? `${listId}-${current}` : undefined}
      aria-label="Search quotes, customers and settings"
      data-testid="global-search-input"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="search"
      placeholder="Find a quote, customer or setting"
      tabIndex={open ? 0 : -1}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setActive(0);
      }}
      onBlur={() => window.setTimeout(close, 120)}
      onKeyDown={onKeyDown}
      className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400", open ? "" : "pointer-events-none opacity-0")}
    />
  );

  if (variant === "phone") {
    return (
      <div ref={root}>
        <button type="button" className="rounded-lg p-2 hover:bg-white/10" aria-label="Search" aria-expanded={open} data-testid="global-search-button" onClick={() => setOpen(true)}>
          <Search className="h-4 w-4" />
        </button>
        {open ? (
          <div className="fixed inset-x-0 top-0 z-[70] flex items-center gap-2 bg-[var(--color-atlas-navy)] px-3 py-2.5">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-[var(--color-text)]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              {field}
            </label>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={close} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Close search">
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        {panel}
      </div>
    );
  }

  return (
    <div ref={root} className="relative flex h-8 min-w-0 flex-1 justify-end">
      <div
        className={cn(
          "flex h-8 items-center overflow-hidden rounded-full border border-white/70 bg-white/75 shadow-[0_8px_28px_rgba(15,35,58,0.06)] backdrop-blur-xl transition-[width] duration-200 motion-reduce:transition-none",
          open ? "w-[min(380px,100%)]" : "w-8",
        )}
      >
        <button
          type="button"
          aria-label={open ? "Close search" : "Search"}
          aria-expanded={open}
          title="Search ( / )"
          data-testid="global-search-button"
          onMouseDown={(e) => open && e.preventDefault()}
          onClick={() => (open ? close() : setOpen(true))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-atlas-navy)] hover:bg-white"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        {field}
        {open ? <kbd className="mr-3 hidden shrink-0 rounded border border-b-2 border-[var(--color-border-strong)] bg-slate-50 px-1.5 font-mono text-[10.5px] text-[var(--color-text-muted)] sm:block">Esc</kbd> : null}
      </div>
      {panel}
    </div>
  );
}
