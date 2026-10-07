"use client";

import { useMemo, useState } from "react";
import { FileBarChart } from "lucide-react";
import { Badge, Button, Card, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import type { EnquiryRecord } from "@/lib/types";
import {
  buildPerformanceReport,
  performanceReportCsv,
  type ReportGrouping,
  type ReportPeriod,
} from "@/lib/quotes/performance-report";
import { listDeskOfficersFromQuotes, listOfficersFromQuotes, officerLabel } from "@/lib/quotes/officers";
import { formatCurrency } from "@/lib/utils";

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PerformanceReportPanel({ rows }: { rows: EnquiryRecord[] }) {
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [officer, setOfficer] = useState("all");
  const [groupBy, setGroupBy] = useState<ReportGrouping>("desk");
  const report = useMemo(
    () => buildPerformanceReport(rows, period, officer, groupBy),
    [rows, period, officer, groupBy],
  );

  const officers = useMemo(
    () => (groupBy === "desk" ? listDeskOfficersFromQuotes(rows) : listOfficersFromQuotes(rows)),
    [rows, groupBy],
  );

  function switchGrouping(next: ReportGrouping) {
    setGroupBy(next);
    setOfficer("all"); // the filter list changes with the view
  }

  function exportCsv() {
    downloadText(`atlas-performance-${period}.csv`, performanceReportCsv(report));
    toast("Performance report CSV downloaded", "success");
  }

  function printReport() {
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      toast("Pop-up blocked — allow pop-ups to print", "error");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>${report.label}</title>
      <style>body{font-family:system-ui;padding:24px;color:#0b1b3a} table{border-collapse:collapse;width:100%;margin-top:16px}
      th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;font-size:12px} h1{font-size:18px}</style></head><body>
      <h1>Vertex desk performance</h1>
      <p>${report.label} · Officer: ${report.officer} · Grouped by ${report.groupBy === "desk" ? "desk" : "person"}</p>
      <p>Total ${report.total} · Open ${report.open} · Won ${report.won} · Lost ${report.lost} · Conversion ${report.conversion}%</p>
      <p>Revenue ${report.revenue} · GP ${report.gp}</p>
      <table><thead><tr><th>${report.groupBy === "desk" ? "Desk" : "Person"}</th><th>Quotes</th><th>Won</th><th>Revenue</th><th>Detail</th></tr></thead><tbody>
      ${report.byDesk.map((d) => `<tr><td>${d.desk}</td><td>${d.count}</td><td>${d.won}</td><td>${d.revenue}</td><td>${d.detail}</td></tr>`).join("")}
      </tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FileBarChart className="h-4 w-4" />
        <h2 className="font-bold">Desk performance</h2>
        <Badge tone="info">{report.label}</Badge>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Group report by"
          className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)] text-sm"
        >
          {(["desk", "person"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={groupBy === g}
              onClick={() => switchGrouping(g)}
              className={`px-3 py-1.5 ${
                groupBy === g ? "bg-slate-100 font-bold" : "bg-white"
              } ${g === "person" ? "border-l border-[var(--color-border)]" : ""}`}
            >
              {g === "desk" ? "By desk" : "By person"}
            </button>
          ))}
        </div>
        <Select
          value={period}
          onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
          className="w-40"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
          <option value="all">All time</option>
        </Select>
        <Select value={officer} onChange={(e) => setOfficer(e.target.value)} className="w-56">
          <option value="all">{groupBy === "desk" ? "All desks" : "All officers"} ({rows.length} quotes)</option>
          {officers.map((o) => (
            <option key={o.id} value={o.id}>
              {officerLabel(o)}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
        <Button type="button" variant="secondary" onClick={printReport}>
          Print
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xs text-[var(--color-text-muted)]">Quotes</div>
          <div className="text-xl font-extrabold">{report.total}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xs text-[var(--color-text-muted)]">Won / Conv.</div>
          <div className="text-xl font-extrabold">
            {report.won} · {report.conversion}%
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xs text-[var(--color-text-muted)]">Revenue</div>
          <div className="text-xl font-extrabold">{formatCurrency(report.revenue, "INR")}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xs text-[var(--color-text-muted)]">GP</div>
          <div className="text-xl font-extrabold text-emerald-700">
            {formatCurrency(report.gp, "USD")}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        {groupBy === "desk"
          ? "Each desk keeps its own totals, whoever has been sitting there."
          : "Each person is credited for the quotes they made, across every desk they worked."}
      </p>
      {report.byDesk.length > 0 ? (
        <ul className="mt-1 max-h-72 space-y-1 overflow-auto text-sm">
          {report.byDesk.map((d) => (
            <li key={d.desk} className="flex justify-between gap-3 rounded-md px-2 py-1 hover:bg-slate-50">
              <span>
                {d.desk}
                {d.detail ? (
                  <span className="block text-xs text-[var(--color-text-muted)]">{d.detail}</span>
                ) : null}
              </span>
              <span className="whitespace-nowrap tabular-nums text-[var(--color-text-muted)]">
                {d.won}/{d.count} · {formatCurrency(d.revenue, "INR")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">No quotes in this window.</p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        Officers are everyone who appears on quotes Vertex can load — every desk and named
        login, not only a short staff list. Monthly shows who quoted this month;
        people with 0 this period still appear. Switch All time for the full team. Old files: Ask
        Vertex or Enquiry DB → Find a quote (customer or city — no file name).
      </p>
    </Card>
  );
}
