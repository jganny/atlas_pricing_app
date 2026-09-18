"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button, Card, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import {
  REPORT_DIMS,
  buildReport,
  reportToCsv,
  type ReportDim,
  type ReportSort,
} from "@/lib/quotes/edb-report-builder";
import type { EnquiryLegKind, EnquiryRecord } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type KindFilter = EnquiryLegKind | "all";

const PRESETS: Array<{ label: string; dims: ReportDim[]; kind?: KindFilter }> = [
  { label: "Airline-wise", dims: ["carrier"], kind: "airline" },
  { label: "Coloader-wise", dims: ["carrier"], kind: "coloader" },
  { label: "Liner-wise", dims: ["carrier"], kind: "liner" },
  { label: "POL-wise", dims: ["pol"] },
  { label: "POD-wise", dims: ["pod"] },
  { label: "Tonnage-wise", dims: ["tonnage"] },
  { label: "Lane × Carrier", dims: ["lane", "carrier"] },
  { label: "Carrier × Tonnage", dims: ["carrier", "tonnage"] },
  { label: "Customer × Carrier", dims: ["customer", "carrier"] },
];

export function ReportBuilderPanel({ rows }: { rows: EnquiryRecord[] }) {
  const [dims, setDims] = useState<ReportDim[]>(["carrier"]);
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<ReportSort>("sell");

  const report = useMemo(
    () => buildReport(rows, dims, sort, { carrierKind: kind }),
    [rows, dims, sort, kind],
  );
  const totals = useMemo(
    () =>
      report.reduce(
        (t, r) => ({ sell: t.sell + r.sellInr, gp: t.gp + r.gpInr, tonnes: t.tonnes + r.tonnes }),
        { sell: 0, gp: 0, tonnes: 0 },
      ),
    [report],
  );

  function toggleDim(d: ReportDim) {
    setDims((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function download() {
    if (!dims.length || !report.length) {
      toast("Pick at least one grouping with data to export", "error");
      return;
    }
    const blob = new Blob([reportToCsv(report, dims)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-report-${dims.join("-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${report.length} report rows`, "success");
  }

  return (
    <Card className="space-y-3" data-testid="report-builder">
      <div>
        <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Report builder</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Groups the {rows.length} quotes in your current Enquiry DB view (filters above apply). Multi-lane quotes are
          counted per lane, with revenue split by each lane&apos;s share. Sell/GP in INR.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setDims(p.dims);
              setKind(p.kind ?? "all");
            }}
            className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--color-atlas-navy)] hover:border-[var(--color-atlas-gold)]"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Group by (click in the order you want columns)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_DIMS.map((d) => {
            const idx = dims.indexOf(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={idx >= 0}
                onClick={() => toggleDim(d.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold",
                  idx >= 0
                    ? "bg-[var(--color-atlas-navy)] text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]",
                )}
              >
                {idx >= 0 ? `${idx + 1}. ` : ""}
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold">
          Carrier type
          <Select value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} className="w-40">
            <option value="all">All</option>
            <option value="airline">Airlines only</option>
            <option value="coloader">Coloaders only</option>
            <option value="liner">Liners only</option>
          </Select>
        </label>
        <label className="text-xs font-semibold">
          Sort by
          <Select value={sort} onChange={(e) => setSort(e.target.value as ReportSort)} className="w-40">
            <option value="sell">Sell value</option>
            <option value="gp">Gross profit</option>
            <option value="quotes">Number of quotes</option>
            <option value="tonnes">Tonnage</option>
            <option value="winRate">Win rate</option>
            <option value="key">Name (A–Z)</option>
          </Select>
        </label>
        <Button type="button" size="sm" className="gap-1.5" onClick={download}>
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </Button>
      </div>

      {dims.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Pick at least one grouping above.</p>
      ) : (
        <div className="max-h-[26rem] overflow-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                {dims.map((d) => (
                  <th key={d} className="px-3 py-2">
                    {REPORT_DIMS.find((x) => x.id === d)?.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Quotes</th>
                <th className="px-3 py-2 text-right">Won</th>
                <th className="px-3 py-2 text-right">Win %</th>
                <th className="px-3 py-2 text-right">Sell (INR)</th>
                <th className="px-3 py-2 text-right">GP (INR)</th>
                <th className="px-3 py-2 text-right">Tonnes</th>
              </tr>
            </thead>
            <tbody>
              {report.length === 0 ? (
                <tr>
                  <td colSpan={dims.length + 6} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    No quotes match this grouping in the current view.
                  </td>
                </tr>
              ) : (
                report.map((r) => (
                  <tr key={r.keys.join("|")} className="border-b last:border-0">
                    {r.keys.map((k, i) => (
                      <td key={i} className="px-3 py-1.5 font-semibold">
                        {k}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.quotes}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.won}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(r.winRate * 100).toFixed(0)}%</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(r.sellInr, "INR")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(r.gpInr, "INR")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.tonnes.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {report.length > 0 ? (
              <tfoot className="sticky bottom-0 border-t bg-slate-50 text-xs font-extrabold">
                <tr>
                  <td colSpan={dims.length + 3} className="px-3 py-2 text-right">
                    Total ({report.length} rows)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.sell, "INR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.gp, "INR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totals.tonnes.toFixed(2)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </Card>
  );
}
