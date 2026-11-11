"use client";

import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { DRILL_GROUPS, DRILL_METRICS, drill, filterForDrillRow, type DrillFilter, type DrillMetric, type DrillRow } from "@/lib/quotes/edb-drill";
import type { ReportDim } from "@/lib/quotes/edb-report-builder";
import { GP_TONE_CLASS, GP_TONE_MEANING, formatTonnage } from "@/lib/quotes/edb-metrics";
import { DESK_SEATS } from "@/lib/auth/desk-seats";
import type { EnquiryRecord } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const COMPARE: Array<{ months: number; label: string }> = [
  { months: 0, label: "No comparison" },
  { months: 1, label: "Last month vs the month before" },
  { months: 3, label: "Last 3 months vs the 3 before" },
  { months: 6, label: "Last 6 months vs the 6 before" },
  { months: 12, label: "Last 12 months vs the 12 before" },
];

function show(metric: DrillMetric, v: number): string {
  if (metric === "quotes") return v.toLocaleString("en-IN");
  if (metric === "gpPct") return `${v.toFixed(1)}%`;
  if (metric === "tonnes") return formatTonnage(v);
  return formatCurrency(v, "INR");
}

function pct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

/** The change against the period before: percentage points for an average GP %, otherwise a percentage. */
function changeText(metric: DrillMetric, c: number): string {
  return metric === "gpPct" ? `${Math.abs(c).toFixed(1)} pts` : pct(Math.abs(c));
}

function csv(rows: DrillRow[], groupLabel: string): string {
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const head = [groupLabel, "Quotes", "Won", "Win rate %", "Sell (INR)", "GP % (total GP / total sell)", "GP won (INR)", "GP open (INR)", "GP lost (INR)", "Tonnes"];
  const lines = rows.map((r) => [r.key, r.quotes, r.won, (r.winRate * 100).toFixed(1), Math.round(r.sell), r.gpPct == null ? "" : r.gpPct.toFixed(2), Math.round(r.gpBy.won), Math.round(r.gpBy.open), Math.round(r.gpBy.lost), r.tonnes.toFixed(2)].map(esc).join(","));
  return [head.map(esc).join(","), ...lines].join("\n");
}

/**
 * Opens from the summary numbers of the Enquiry DB. Shows what the number is made of, by mode, desk, customer, carrier, lane, status or month,
 * with an optional comparison against the period before. Clicking a row filters the table to it. Staff only. Uses no AI credit.
 */
export function EnquiryDrillDown({
  rows,
  metric,
  onMetric,
  onApply,
  onClose,
  initialDim,
}: {
  rows: EnquiryRecord[];
  metric: DrillMetric;
  onMetric: (m: DrillMetric) => void;
  onApply: (f: DrillFilter, label: string) => void;
  onClose: () => void;
  /** The grouping to start with (for example the user, when opened from "Average GP % by user"). */
  initialDim?: ReportDim;
}) {
  const [dim, setDim] = useState<ReportDim>(initialDim ?? "customer");
  const [compareMonths, setCompareMonths] = useState(0);
  const [top, setTop] = useState(12);
  const result = useMemo(() => drill(rows, dim, metric, { top, compareMonths }), [rows, dim, metric, top, compareMonths]);
  const groupLabel = DRILL_GROUPS.find((g) => g.id === dim)?.label ?? "Group";
  const seatIds = useMemo(() => Object.fromEntries(DESK_SEATS.map((s) => [s.label, `seat:${s.id}`])), []);
  const max = Math.max(1, ...result.rows.map((r) => Math.max(r.value, r.prevValue ?? 0)));
  const clickable = (r: DrillRow) => filterForDrillRow(dim, r.key, seatIds).kind !== "none";

  return (
    <Card className="space-y-3 p-3" data-testid="edb-drilldown">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-bold text-[var(--color-atlas-navy)]">
          What is behind the number <span className="font-normal text-slate-500">· {rows.length.toLocaleString("en-IN")} quotes in view</span>
        </h3>
        <div role="tablist" aria-label="Number to break down" className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-xs font-semibold">
          {DRILL_METRICS.map((m, i) => (
            <button key={m.id} role="tab" aria-selected={metric === m.id} type="button" onClick={() => onMetric(m.id)} className={cn("px-3 py-1.5", i > 0 && "border-l border-[var(--color-border)]", metric === m.id ? "bg-sky-100 text-sky-900" : "text-slate-700 hover:bg-slate-50")}>
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close breakdown" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="block">
          <span className="font-bold uppercase text-[var(--color-text-muted)]">Group by</span>
          <Select value={dim} onChange={(e) => setDim(e.target.value as ReportDim)} className="!mt-0.5 !py-1.5" data-testid="drill-group">
            {DRILL_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="font-bold uppercase text-[var(--color-text-muted)]">Compare</span>
          <Select value={compareMonths} onChange={(e) => setCompareMonths(Number(e.target.value))} className="!mt-0.5 !py-1.5" data-testid="drill-compare">
            {COMPARE.map((c) => (
              <option key={c.months} value={c.months}>{c.label}</option>
            ))}
          </Select>
        </label>
        {dim !== "month" ? (
          <label className="block">
            <span className="font-bold uppercase text-[var(--color-text-muted)]">Show</span>
            <Select value={top} onChange={(e) => setTop(Number(e.target.value))} className="!mt-0.5 !py-1.5">
              <option value={5}>Top 5</option>
              <option value={12}>Top 12</option>
              <option value={0}>All</option>
            </Select>
          </label>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="ml-auto"
          onClick={() => {
            const blob = new Blob([csv(result.rows, groupLabel)], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `atlas-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast(`Exported ${result.rows.length} rows`, "success");
          }}
        >
          <Download className="mr-1 h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      {result.compare ? (
        <p className="text-xs text-slate-600" data-testid="drill-compare-note">
          {result.compare.currentLabel} against {result.compare.previousLabel}.
          {result.compare.previousHasData ? "" : " There are no quotes in the earlier period within the quotes in view, so no percentages can be shown. Widen the date filter to compare."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Total {DRILL_METRICS.find((m) => m.id === metric)?.label}</div>
          <div className="text-lg font-extrabold tabular-nums" data-testid="drill-total">{show(metric, result.total.value)}</div>
        </div>
        {result.total.change != null ? (
          <div className={cn("text-sm font-bold tabular-nums", result.total.change >= 0 ? "text-emerald-700" : "text-red-700")}>
            {result.total.change >= 0 ? "▲" : "▼"} {changeText(metric, result.total.change)} vs before ({show(metric, result.total.prevValue ?? 0)})
          </div>
        ) : null}
      </div>

      {result.rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Nothing to break down. Clear a filter to see more quotes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm" data-testid="drill-table">
            <thead className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="py-1 pr-2">{groupLabel}</th>
                <th className="py-1 pr-2">{DRILL_METRICS.find((m) => m.id === metric)?.label}</th>
                {metric === "gpPct" ? null : <th className="py-1 pr-2 text-right">Share</th>}
                <th className="py-1 pr-2 text-right">Quotes</th>
                <th className="py-1 pr-2 text-right" title="Total GP of these quotes as a share of their total sell">GP %</th>
                <th className="py-1 pr-2 text-right">Win rate</th>
                <th className="py-1 pr-2">GP <span className="font-normal normal-case"><span className={GP_TONE_CLASS.won}>won</span> · <span className={GP_TONE_CLASS.open}>open</span> · <span className={GP_TONE_CLASS.lost}>lost</span></span></th>
                {result.compare ? <th className="py-1 text-right">Change</th> : null}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const can = clickable(r);
                return (
                  <tr key={r.key} className={cn("border-t border-[var(--color-border)]", can && "cursor-pointer hover:bg-sky-50")} onClick={can ? () => onApply(filterForDrillRow(dim, r.key, seatIds), r.key) : undefined} title={can ? "Click to show only these quotes in the table" : undefined}>
                    <td className="max-w-[14rem] truncate py-1.5 pr-2 font-semibold">{r.key}</td>
                    <td className="py-1.5 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 shrink-0 rounded bg-slate-100" aria-hidden>
                          <div className="h-2 rounded bg-sky-600" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
                          {r.prevValue != null ? <div className="mt-0.5 h-1 rounded bg-slate-400" style={{ width: `${Math.max(2, (r.prevValue / max) * 100)}%` }} /> : null}
                        </div>
                        <span className="font-bold tabular-nums">{show(metric, r.value)}</span>
                      </div>
                    </td>
                    {metric === "gpPct" ? null : <td className="py-1.5 pr-2 text-right tabular-nums">{pct(r.share)}</td>}
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.quotes}</td>
                    <td className="py-1.5 pr-2 text-right font-semibold tabular-nums" data-testid="drill-gp-pct">{r.gpPct == null ? "—" : `${r.gpPct.toFixed(1)}%`}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.quotes ? pct(r.winRate) : "—"}</td>
                    <td className="py-1.5 pr-2 text-xs font-bold tabular-nums">
                      <span className={GP_TONE_CLASS.won} title={GP_TONE_MEANING.won}>{formatCurrency(r.gpBy.won, "INR")}</span>{" "}
                      <span className={GP_TONE_CLASS.open} title={GP_TONE_MEANING.open}>{formatCurrency(r.gpBy.open, "INR")}</span>{" "}
                      <span className={GP_TONE_CLASS.lost} title={GP_TONE_MEANING.lost}>{formatCurrency(r.gpBy.lost, "INR")}</span>
                    </td>
                    {result.compare ? (
                      <td className={cn("py-1.5 text-right text-xs font-bold tabular-nums", r.change == null ? "text-slate-400" : r.change >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {r.change == null ? (r.value > 0 ? "New" : "—") : `${r.change >= 0 ? "▲" : "▼"} ${changeText(metric, r.change)}`}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        GP % is the group&apos;s total GP divided by its total sell, so a big quote counts for more than a small one (it is not the average of each quote&apos;s percentage). A quote with several lanes counts once in each lane&apos;s group, so group counts can add up to more than the total. Bars: the dark bar is the period before, when comparing. This screen is for staff only.
      </p>
    </Card>
  );
}
