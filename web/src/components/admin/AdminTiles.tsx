"use client";

import type { Tile, Tone } from "@/lib/admin/signals";
import { ADMIN_ICONS } from "./admin-icons";
import { cn } from "@/lib/utils";

const PILL: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
  mute: "bg-slate-100 text-slate-600",
};
const BAR: Record<Tone, string> = { ok: "bg-emerald-600", warn: "bg-amber-500", bad: "bg-red-500", mute: "bg-slate-400" };

/** "At a glance": a few live numbers that tell the administrator what needs attention. Each tile opens its section. */
export function AdminTiles({ tiles, onOpen }: { tiles: Tile[]; onOpen: (id: string) => void }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-label="At a glance" className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = ADMIN_ICONS[t.icon];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(t.id)}
            data-testid={`admin-tile-${t.id}`}
            data-tone={t.tone}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] sm:p-4"
          >
            <span className="flex flex-col items-start gap-1.5 text-[13px] text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t.label}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", PILL[t.tone])}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {t.pill}
              </span>
            </span>
            <span className="text-2xl font-bold leading-tight tabular-nums tracking-tight sm:text-[26px]">{t.value}</span>
            {t.bar !== undefined ? (
              <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <span className={cn("block h-full rounded-full", BAR[t.tone])} style={{ width: `${Math.round(t.bar * 100)}%` }} />
              </span>
            ) : null}
            <span className="text-[12.5px] text-[var(--color-text-muted)]">{t.sub}</span>
          </button>
        );
      })}
    </section>
  );
}
