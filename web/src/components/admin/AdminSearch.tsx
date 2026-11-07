"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchSections, type AdminSectionDef } from "@/lib/admin/sections";
import { ADMIN_ICONS } from "./admin-icons";
import { cn } from "@/lib/utils";

function Highlight({ text, words }: { text: string; words: string[] }) {
  const lower = text.toLowerCase();
  const hit = words.map((w) => ({ w, i: lower.indexOf(w) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0];
  if (!hit) return <>{text}</>;
  return (
    <>
      {text.slice(0, hit.i)}
      <mark className="rounded-sm bg-amber-100 px-px text-amber-900">{text.slice(hit.i, hit.i + hit.w.length)}</mark>
      {text.slice(hit.i + hit.w.length)}
    </>
  );
}

/**
 * The big search box at the top of the Admin console. Type any everyday word ("password", "holiday", "money") and the matching
 * sections drop down; arrow keys move, Enter opens, Esc closes. Press / anywhere on the page to jump into it.
 * With the box empty it lists the sections opened most recently.
 */
export function AdminSearch({ sections, recent, onOpen }: { sections: AdminSectionDef[]; recent: string[]; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const results = useMemo(() => {
    if (words.length) return searchSections(query, sections).slice(0, 7);
    return recent.map((id) => sections.find((s) => s.id === id)).filter((s): s is AdminSectionDef => !!s).slice(0, 4);
  }, [query, words, sections, recent]);
  const active = Math.min(sel, Math.max(0, results.length - 1));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(id: string) {
    setQuery("");
    setOpen(false);
    setSel(0);
    input.current?.blur();
    onOpen(id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setSel(Math.min(active + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel(Math.max(active - 1, 0));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      pick(results[active].id);
    } else if (e.key === "Escape" && (open || query)) {
      // Close the box only; Esc on an empty, closed box still leaves the page as everywhere else in the app.
      e.preventDefault();
      setQuery("");
      setOpen(false);
      input.current?.blur();
    }
  }

  const listId = "admin-search-results";
  const showList = open && (results.length > 0 || words.length > 0);

  return (
    <div className="relative">
      <label
        htmlFor="admin-search"
        className="flex h-14 items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 shadow-sm transition-colors focus-within:border-[var(--color-atlas-sky)]"
      >
        <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <input
          id="admin-search"
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `admin-opt-${results[active].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Find a setting or report"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden rounded-md border border-b-2 border-[var(--color-border-strong)] bg-slate-50 px-1.5 font-mono text-xs text-[var(--color-text-muted)] sm:block">/</kbd>
      </label>

      {showList ? (
        <div id={listId} role="listbox" aria-label="Matching sections" className="absolute inset-x-0 top-[62px] z-30 rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-xl">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {words.length ? (results.length === 1 ? "1 match" : `${results.length} matches`) : "Recently opened"}
          </div>
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">Nothing matches &ldquo;{query.trim()}&rdquo;. Try a shorter word.</p>
          ) : (
            results.map((s, i) => {
              const Icon = ADMIN_ICONS[s.icon];
              return (
                <button
                  key={s.id}
                  id={`admin-opt-${s.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s.id);
                  }}
                  onMouseEnter={() => setSel(i)}
                  className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left", i === active ? "bg-slate-50" : "")}
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", i === active ? "bg-[var(--color-atlas-navy)] text-white" : "bg-[var(--color-atlas-gold-soft)] text-[var(--color-atlas-sky)]")}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      <Highlight text={s.title} words={words} />
                    </span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{s.blurb}</span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{s.group}</span>
                </button>
              );
            })
          )}
          <div className="mt-1 hidden items-center gap-4 border-t border-[var(--color-border)] px-3 pb-1 pt-2 text-xs text-slate-400 sm:flex">
            <span>
              <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> move
            </span>
            <span>
              <kbd className="font-mono">Enter</kbd> open
            </span>
            <span>
              <kbd className="font-mono">Esc</kbd> close
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
