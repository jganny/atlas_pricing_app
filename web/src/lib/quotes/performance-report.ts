/** Performance report windows — daily → annual (legacy generatePerformanceReport). */

import type { EnquiryRecord } from "@/lib/types";
import { DESK_SEATS, OWNED_DESK_SEATS, personDisplayName, quoteDeskSeatId } from "@/lib/auth/desk-seats";
import { deskDisplayName, demoSafeId, TEAM_ROLES } from "@/lib/quotes/team-roles";
import { gpAmountInr, sellAmountInr } from "@/lib/quotes/money";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "all";

/** "desk" totals each desk whoever sat there; "person" credits each person across every desk they worked. */
export type ReportGrouping = "desk" | "person";

export function periodWindow(period: ReportPeriod, now = new Date()): { from: Date; to: Date; label: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  if (period === "all") {
    from.setFullYear(2000, 0, 1);
    return { from, to, label: "All time · every quote in this list" };
  }
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
  groupBy: ReportGrouping;
  /** One line per group (a desk or a person, per `groupBy`) — `detail` says who/where the work came from. */
  byDesk: Array<{ desk: string; count: number; won: number; revenue: number; detail: string }>;
  rows: EnquiryRecord[];
}

function deskLabel(seatId: string): string {
  return DESK_SEATS.find((x) => x.id === seatId)?.label ?? seatId;
}

function personOf(r: EnquiryRecord): string {
  return r.creatorName || personDisplayName(r.creator);
}

export function buildPerformanceReport(
  rows: EnquiryRecord[],
  period: ReportPeriod,
  officer = "all",
  groupBy: ReportGrouping = "person",
): PerformanceReport {
  const { from, to, label } = periodWindow(period);
  const filtered = rows.filter((r) => {
    if (officer.startsWith("seat:")) {
      if (quoteDeskSeatId(r) !== officer.slice(5)) return false;
    } else if (officer !== "all" && (r.creator || "").toLowerCase() !== officer.toLowerCase()) {
      return false;
    }
    const d = rowDate(r);
    if (!d) return true;
    return d >= from && d <= to;
  });
  const open = filtered.filter((e) => e.status === "open" || e.status === "quoted").length;
  const won = filtered.filter((e) => e.status === "won").length;
  const lost = filtered.filter((e) => e.status === "lost" || e.status === "cancelled").length;
  const revenue = filtered
    .filter((e) => e.status === "won")
    .reduce((s, e) => s + sellAmountInr(e), 0);
  const gp = filtered.reduce((s, e) => s + gpAmountInr(e), 0);

  // A group is a desk (its own seat id; non-desk logins stay by person) or a person (their login).
  const groupKey = (r: EnquiryRecord): string => {
    if (groupBy === "desk") {
      const seat = quoteDeskSeatId(r);
      if (seat && OWNED_DESK_SEATS.includes(seat)) return `seat:${seat}`;
    }
    return (r.creator || "unknown").toLowerCase();
  };
  const groups: Record<string, { count: number; won: number; revenue: number; parts: Map<string, number> }> = {};
  const ensure = (k: string) => (groups[k] ??= { count: 0, won: 0, revenue: 0, parts: new Map() });
  for (const e of filtered) {
    const g = ensure(groupKey(e));
    g.count += 1;
    if (e.status === "won") {
      g.won += 1;
      g.revenue += sellAmountInr(e);
    }
    // Desk view: who did the work. Person view: which desks they worked in.
    const seat = quoteDeskSeatId(e);
    const part = groupBy === "desk" ? personOf(e) : seat ? deskLabel(seat) : "own login";
    g.parts.set(part, (g.parts.get(part) ?? 0) + 1);
  }
  if (groupBy === "desk") {
    for (const s of OWNED_DESK_SEATS) ensure(`seat:${s}`);
    for (const e of rows) {
      const k = groupKey(e);
      if (k) ensure(k);
    }
  } else {
    for (const e of rows) {
      const k = (e.creator || "").toLowerCase();
      if (k) ensure(k);
    }
    for (const id of Object.keys(TEAM_ROLES)) ensure(id);
  }
  const byDesk = Object.entries(groups)
    .map(([key, v]) => {
      let name: string;
      if (key.startsWith("seat:")) name = deskLabel(key.slice(5));
      else {
        const l = deskDisplayName(key);
        name = l.toLowerCase() === key ? key : `${l} · ${demoSafeId(key)}`;
      }
      const detail = [...v.parts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([n, c]) => `${n} ${c}`)
        .join(" · ");
      return { desk: name, count: v.count, won: v.won, revenue: v.revenue, detail };
    })
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
    groupBy,
    byDesk,
    rows: filtered,
  };
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
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
    `Grouped by,${report.groupBy === "desk" ? "Desk" : "Person"}`,
    `${report.groupBy === "desk" ? "Desk" : "Person"},Quotes,Won,Revenue,Detail`,
    ...report.byDesk.map((d) => `${csvCell(d.desk)},${d.count},${d.won},${d.revenue},${csvCell(d.detail)}`),
  ];
  return lines.join("\n");
}
