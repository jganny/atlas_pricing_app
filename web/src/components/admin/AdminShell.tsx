"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Link2, Shield } from "lucide-react";
import { toast } from "@/components/Toast";
import { AdminSearch } from "./AdminSearch";
import { AdminTiles } from "./AdminTiles";
import { ADMIN_ICONS } from "./admin-icons";
import { useAdminSignals } from "./use-admin-signals";
import { groupSections, hashFor, parseRecent, pushRecent, RECENT_KEY, sectionFromHash, visibleSections, type AdminContext } from "@/lib/admin/sections";
import { buildTiles, railBadges } from "@/lib/admin/signals";
import { cn } from "@/lib/utils";

/**
 * The Admin console's frame: a search box, a few "at a glance" tiles, a grouped list of sections and the one section that is open.
 * What each section looks like is not decided here; `render(id)` returns the section's own screen.
 * Each section has its own link (…/admin/#password-reset-queue), the list remembers what was opened last, and nobody sees a
 * section they may not use.
 */
export function AdminShell({
  ctx,
  username,
  resets,
  render,
}: {
  ctx: AdminContext;
  username: string;
  resets: { count: number; oldestAt: number | null };
  render: (id: string) => React.ReactNode;
}) {
  const list = useMemo(() => visibleSections(ctx), [ctx]);
  const groups = useMemo(() => groupSections(list), [list]);

  // A jump from the top-bar search arrives as /admin/?section=…, which is known as soon as the page draws (the "#…" part is not).
  const params = useSearchParams();
  const requested = sectionFromHash(params?.get("section") ?? "", list);

  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return parseRecent(localStorage.getItem(RECENT_KEY), list);
    } catch {
      return [];
    }
  });
  const [cur, setCur] = useState<string>(() => sectionFromHash(window.location.hash, list) ?? requested ?? recent[0] ?? list[0]?.id ?? "");
  const [seenRequest, setSeenRequest] = useState<string | null>(requested);
  if (requested !== seenRequest) {
    // Adjusting state while drawing: a new request from the search selects that section once.
    setSeenRequest(requested);
    if (requested) setCur(requested);
  }

  const signals = useAdminSignals(ctx, resets);
  const tiles = useMemo(() => buildTiles(signals, ctx), [signals, ctx]);
  const badges = useMemo(() => railBadges(signals), [signals]);

  const open = useCallback(
    (id: string, scroll = true) => {
      if (!list.some((s) => s.id === id)) return;
      setCur(id);
      setRecent((r) => {
        const next = pushRecent(r, id);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* private window: the list simply isn't remembered */
        }
        return next;
      });
      try {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${hashFor(id)}`);
      } catch {
        /* the link just isn't updated */
      }
      if (scroll) document.getElementById("admin-section")?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    [list],
  );

  // Someone pastes or follows a link to another section while this page is open.
  useEffect(() => {
    function onHash() {
      const id = sectionFromHash(window.location.hash, list);
      if (id) setCur(id);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [list]);

  const section = list.find((s) => s.id === cur) ?? list[0];

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}${hashFor(section.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied", "success");
    } catch {
      toast(url, "info");
    }
  }

  if (!section) return null;
  const Icon = ADMIN_ICONS[section.icon];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[var(--color-atlas-navy)]">
            <Shield className="h-5 w-5 text-[var(--color-atlas-sky)]" aria-hidden />
            Admin console
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Everything the administrator manages, in one place.</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-white py-1 pl-1 pr-3.5 shadow-sm">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--color-atlas-navy)] text-[13px] font-semibold text-white" aria-hidden>
            {username.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[13px] text-[var(--color-text-muted)]">
            <strong className="font-semibold text-[var(--color-text)]">{username}</strong> · {ctx.isGanny ? "Main administrator" : "Administrator"}
          </span>
        </div>
      </header>

      <AdminSearch sections={list} recent={recent} onOpen={open} />

      <AdminTiles tiles={tiles} onOpen={open} />

      {/* Narrow screens: one tidy picker instead of the list beside the section. */}
      <div className="xl:hidden">
        <label htmlFor="admin-picker" className="mb-1.5 ml-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Section
        </label>
        <div className="relative flex h-[52px] items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-3.5 shadow-sm">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-atlas-navy)] text-white">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{section.title}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <select
            id="admin-picker"
            value={section.id}
            onChange={(e) => open(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            style={{ fontSize: 16 }}
          >
            {groups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {badges[s.id] ? ` (${badges[s.id].text})` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
        <nav aria-label="Admin sections" className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-sm xl:block">
          {groups.map((g, gi) => (
            <div key={g.group}>
              <div className={cn("px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400", gi === 0 ? "pt-2" : "pt-4")}>{g.group}</div>
              {g.items.map((s) => {
                const I = ADMIN_ICONS[s.icon];
                const on = s.id === section.id;
                const b = badges[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => open(s.id)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                      on ? "bg-[var(--color-atlas-navy)] text-white" : "text-[var(--color-text-muted)] hover:bg-slate-50 hover:text-[var(--color-text)]",
                    )}
                  >
                    <I className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {b ? (
                      <span
                        className={cn(
                          "min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold",
                          on ? "bg-white/20 text-white" : b.tone === "bad" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800",
                        )}
                      >
                        {b.text}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div id="admin-section" className="min-w-0 scroll-mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-slate-400">
              <span className="hidden truncate sm:inline">{section.group}</span>
              <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 sm:inline" aria-hidden />
              <span className="truncate">{section.title}</span>
            </p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-slate-50"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Copy link
            </button>
          </div>
          {/* Some sections carry their own top margin from when they were stacked; the frame handles spacing now. */}
          <div key={section.id} className="space-y-4 [&>section]:!mt-0" data-testid={`admin-section-${section.id}`}>
            {render(section.id)}
          </div>
        </div>
      </div>
    </div>
  );
}
