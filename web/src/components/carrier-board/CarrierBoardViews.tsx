"use client";

import { PER_KG_BREAKS, breakKeyFor, type LaneView, type PricedRow } from "@/lib/carriers/board";
import { cn } from "@/lib/utils";



const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isoDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`).getTime() : null);

/** How long each airline's tariff stays valid. The dark line is today. */
export function ValidityTimeline({ rows, today }: { rows: PricedRow[]; today: Date }) {
  const dated = rows.filter((r) => isoDay(r.tariff.validTo) !== null);
  if (!dated.length) return <p className="text-sm text-[var(--color-text-muted)]">No tariff on this lane has a validity date.</p>;
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastEnd = Math.max(...dated.map((r) => isoDay(r.tariff.validTo) ?? 0));
  const end = new Date(Math.max(lastEnd, new Date(today.getFullYear(), today.getMonth() + 5, 1).getTime()));
  const S = first.getTime(), span = end.getTime() - S;
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - S) / span) * 100));
  const months: Array<{ label: string; t: number }> = [];
  for (let d = new Date(first); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ label: MONTHS[d.getMonth()], t: d.getTime() });
  const todayT = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const color = { ok: "bg-emerald-600", soon: "bg-amber-500", expired: "bg-red-600", none: "bg-slate-400" } as const;
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const from = isoDay(r.tariff.validFrom) ?? S, to = isoDay(r.tariff.validTo);
        return (
          <div key={r.code} className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-3 text-xs sm:grid-cols-[120px_minmax(0,1fr)_80px]">
            <span className="truncate font-semibold text-[var(--color-atlas-navy)]">{r.code} <span className="font-normal text-[var(--color-text-muted)]">{r.name.split(" ")[0]}</span></span>
            <span className="relative h-5 overflow-hidden rounded bg-[var(--color-surface-muted)]">
              {months.map((m) => <i key={m.t} className="absolute inset-y-0 w-px bg-[var(--color-border)]" style={{ left: `${pct(m.t)}%` }} />)}
              {to !== null ? <i className={cn("absolute inset-y-1 rounded-sm", color[r.validity])} style={{ left: `${pct(from)}%`, width: `${Math.max(3, pct(to) - pct(from))}%` }} /> : null}
              <i className="absolute inset-y-0 w-0.5 bg-[var(--color-atlas-ink)]" style={{ left: `${pct(todayT)}%` }} />
            </span>
            <span className={cn("text-right font-mono", r.validity === "expired" ? "text-red-700" : r.validity === "soon" ? "text-amber-700" : "text-[var(--color-text-muted)]")}>{r.tariff.validTo || "no date"}</span>
          </div>
        );
      })}
      <div className="grid grid-cols-[96px_minmax(0,1fr)_72px] gap-3 text-[11px] text-[var(--color-text-muted)] sm:grid-cols-[120px_minmax(0,1fr)_80px]">
        <span />
        <span className="relative h-4">{months.map((m) => <span key={m.t} className="absolute" style={{ left: `calc(${pct(m.t)}% + 3px)` }}>{m.label}</span>)}</span>
        <span className="text-right">valid to</span>
      </div>
    </div>
  );
}

/** The FreightLook-style grid: one row per airline, one column per weight break, the shipment's break shaded. */
export function RateGrid({ lane, weightKg }: { lane: LaneView; weightKg: number }) {
  const hit = breakKeyFor(weightKg);
  const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-text-muted)]">
            <th className="py-2 pr-3 text-left">Airline</th>
            <th className="px-3 py-2 text-right">MIN</th>
            {PER_KG_BREAKS.map((b) => (
              <th key={b.key} className={cn("px-3 py-2 text-right", b.key === hit && "bg-blue-50 text-blue-800")}>{b.label} kg</th>
            ))}
            <th className="px-3 py-2 text-right">Valid to</th>
          </tr>
        </thead>
        <tbody>
          {lane.priced.map((r) => (
            <tr key={r.code} className="border-b border-[var(--color-border)] last:border-b-0">
              <td className="whitespace-nowrap py-2.5 pr-3 font-semibold text-[var(--color-atlas-navy)]">{r.code} <span className="font-normal text-[var(--color-text-muted)]">{r.name}</span></td>
              <td className="px-3 py-2.5 text-right text-[var(--color-text-muted)]">{r.tariff.breaks.min ? money(Number(r.tariff.breaks.min)) : "—"}</td>
              {PER_KG_BREAKS.map((b) => {
                const v = Number(r.tariff.breaks[b.key]);
                return <td key={b.key} className={cn("px-3 py-2.5 text-right", b.key === hit && "bg-blue-50 font-semibold")}>{v > 0 ? money(v) : "—"}</td>;
              })}
              <td className={cn("whitespace-nowrap px-3 py-2.5 text-right text-xs", r.validity === "expired" ? "font-semibold text-red-700" : r.validity === "soon" ? "font-semibold text-amber-700" : "text-[var(--color-text-muted)]")}>{r.tariff.validTo || "no date"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
