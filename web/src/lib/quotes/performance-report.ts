/** Performance report windows — daily → annual (legacy generatePerformanceReport). */

import type { EnquiryRecord } from "@/lib/types";
import { deskDisplayName } from "@/lib/quotes/team-roles";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export function periodWindow(period: ReportPeriod, now = new Date()): { from: Date; to: Date; label: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  if (period === "daily") {
    return { from, to, label: `Daily · ${from.toLocaleDateString()}` };
  }
  if (period === "weekly") {
    const day = from.getDay();
    from.setDate(from.getDate() - day);
    return { from, to, label: `Weekly · starting ${from.toLocaleDateString()}` };
  }
  if (period === "monthly") {
    from.setDate(1);
    return { from, to, label: `Monthly · ${from.toLocaleString("en", { month: "long", year: "numeric" })}` };
  }
  if (period === "quarterly") {
    const q = Math.floor(from.getMonth() / 3);
    from.setMonth(q * 3, 1);
    return { from, to, label: `Q${q + 1} · ${from.getFullYear()}` };
  }
  from.setMonth(0, 1);
  return { from, to, label: `Annual · ${from.getFullYear()}` };
}

function rowDate(row: EnquiryRecord): Date | null {
  const raw = row.createdAt || "";
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface PerformanceReport {
  label: string;
  period: ReportPeriod;
  officer: string;
  total: number;
  open: number;
  won: number;
  lost: number;
  revenue: number;
  gp: number;
  conversion: number;
  byDesk: Array<{ desk: string; count: number; won: number; revenue: number }>;
  rows: EnquiryRecord[];
}

export function buildPerformanceReport(
  rows: EnquiryRecord[],
  period: ReportPeriod,
  officer = "all",
): PerformanceReport {
  const { from, to, label } = periodWindow(period);
  const filtered = rows.filter((r) => {
    if (officer !== "all" && (r.creator || "").toLowerCase() !== officer.toLowerCase()) return false;
    const d = rowDate(r);
    if (!d) return true;
    return d >= from && d <= to;
  });
  const open = filtered.filter((e) => e.status === "open" || e.status === "quoted").length;
  const won = filtered.filter((e) => e.status === "won").length;
  const lost = filtered.filter((e) => e.status === "lost" || e.status === "cancelled").length;
  const revenue = filtered
    .filter((e) => e.status === "won")
    .reduce((s, e) => s + (e.amountINR || e.grandTotal || 0), 0);
  const gp = filtered.reduce((s, e) => s + (e.grossProfit || 0), 0);
  const deskMap: Record<string, { count: number; won: number; revenue: number }> = {};
  for (const e of filtered) {
    const k = e.creator || "unknown";
    if (!deskMap[k]) deskMap[k] = { count: 0, won: 0, revenue: 0 };
    deskMap[k].count += 1;
    if (e.status === "won") {
      deskMap[k].won += 1;
      deskMap[k].revenue += e.amountINR || e.grandTotal || 0;
    }
  }
  const byDesk = Object.entries(deskMap)
    .map(([desk, v]) => ({ desk: deskDisplayName(desk), ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    label,
    period,
    officer,
    total: filtered.length,
    open,
    won,
    lost,
    revenue,
    gp,
    conversion: filtered.length ? Math.round((won / filtered.length) * 100) : 0,
    byDesk,
    rows: filtered,
  };
}

export function performanceReportCsv(report: PerformanceReport): string {
  const lines = [
    `Atlas Performance Report,${report.label}`,
    `Officer,${report.officer}`,
    `Total,${report.total}`,
    `Open,${report.open}`,
    `Won,${report.won}`,
    `Lost,${report.lost}`,
    `Conversion %,${report.conversion}`,
    `Revenue,${report.revenue}`,
    `GP,${report.gp}`,
    "",
    "Desk,Quotes,Won,Revenue",
    ...report.byDesk.map((d) => `${d.desk},${d.count},${d.won},${d.revenue}`),
  ];
  return lines.join("\n");
}
