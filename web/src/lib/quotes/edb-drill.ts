/**
 * Drill-down for the Enquiry DB summary numbers. Click a number (quotes, sell, GP, tonnage) and see what it is made of:
 * grouped by mode, desk, customer, carrier, lane, status or month, with each group's share, GP split by outcome
 * (earned / estimated / offered), and an optional comparison with the period just before. Staff only: GP never leaves this screen.
 * Built on the existing report builder, so the numbers always agree with the report builder and the table.
 */
import type { EnquiryRecord } from "@/lib/types";
import { buildReport, type ReportDim, type ReportRow } from "./edb-report-builder";
import { gpTone, type GpTone } from "./edb-metrics";
import { parseCreatedAt } from "./report-periods";

export type DrillMetric = "quotes" | "sell" | "gp" | "gpPct" | "tonnes";

export const DRILL_METRICS: Array<{ id: DrillMetric; label: string }> = [
  { id: "quotes", label: "Quotes" },
  { id: "sell", label: "Sell (INR)" },
  { id: "gp", label: "GP (INR)" },
  { id: "gpPct", label: "Average GP %" },
  { id: "tonnes", label: "Tonnage" },
];

/** The groupings offered in the drill-down. The key of each is a report-builder dimension. */
export const DRILL_GROUPS: Array<{ id: ReportDim; label: string }> = [
  { id: "mode", label: "Mode (Air / Sea…)" },
  { id: "seat", label: "Desk" },
  { id: "desk", label: "User / desk" },
  { id: "customer", label: "Customer" },
  { id: "carrier", label: "Carrier" },
  { id: "lane", label: "Lane (from → to)" },
  { id: "status", label: "Status" },
  { id: "month", label: "Month" },
];

export interface DrillRow {
  key: string;
  quotes: number;
  won: number;
  /** Won quotes as a share of all quotes in the group (0 to 1). */
  winRate: number;
  sell: number;
  gp: number;
  /** Total GP as a share of total sell, in percent (a weighted average: big quotes count more). Null when there is no sell. */
  gpPct: number | null;
  /** GP split by what it means: earned (won), estimated (open or quoted), offered (lost or cancelled). */
  gpBy: Record<GpTone, number>;
  tonnes: number;
  /** The chosen metric's value for this group. */
  value: number;
  /** This group's share of the total (0 to 1). */
  share: number;
  /** The same metric for the period just before, when comparing. */
  prevValue?: number;
  /** The period before's sell and GP, so groups can be folded together without losing a weighted average. */
  prevSell?: number;
  prevGp?: number;
  /** Change against the period before, as a fraction (0.25 = up 25%). Null when there was nothing before. */
  change?: number | null;
}

export interface DrillResult {
  rows: DrillRow[];
  total: { quotes: number; sell: number; gp: number; tonnes: number; value: number; prevValue?: number; change?: number | null };
  /** Set when a comparison was asked for. */
  compare?: { months: number; currentLabel: string; previousLabel: string; previousHasData: boolean };
}

/** Total GP over total sell, in percent (rounded to 2 places). 0 when there is no sell. */
export const gpPctOf = (gp: number, sell: number): number => (sell > 0 ? Math.round((gp / sell) * 10_000) / 100 : 0);

const valueOf = (r: Pick<DrillRow, "quotes" | "sell" | "gp" | "tonnes">, m: DrillMetric): number =>
  m === "quotes" ? r.quotes : m === "sell" ? r.sell : m === "gp" ? r.gp : m === "gpPct" ? gpPctOf(r.gp, r.sell) : r.tonnes;

/** The change against the period before: a share (0.25 = up 25%) for amounts, percentage POINTS for an average GP %. */
const changeOf = (now: number, before: number, points = false): number | null => (points ? (before > 0 ? Math.round((now - before) * 100) / 100 : null) : before > 0 ? (now - before) / before : null);

const mname = (t: number) => new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/** [start, end) of the last `months` months up to `now`, and of the same number of months before that. */
export function comparisonWindows(now: number, months: number): { current: [number, number]; previous: [number, number] } {
  const end = new Date(now);
  const start = new Date(end.getFullYear(), end.getMonth() - months, end.getDate());
  const before = new Date(end.getFullYear(), end.getMonth() - 2 * months, end.getDate());
  return { current: [start.getTime(), now + 1], previous: [before.getTime(), start.getTime()] };
}

function inWindow(r: EnquiryRecord, [a, b]: [number, number]): boolean {
  const t = parseCreatedAt(r.createdAt);
  return t != null && t >= a && t < b;
}

function groupRows(rows: EnquiryRecord[], dim: ReportDim): Map<string, DrillRow> {
  const out = new Map<string, DrillRow>();
  const base = buildReport(rows, [dim], "sell");
  for (const r of base) out.set(r.keys[0], fromReport(r));
  for (const tone of ["won", "open", "lost"] as GpTone[]) {
    for (const r of buildReport(rows.filter((x) => gpTone(x) === tone), [dim], "sell")) {
      const g = out.get(r.keys[0]);
      if (g) g.gpBy[tone] = r.gpInr;
    }
  }
  return out;
}

function fromReport(r: ReportRow): DrillRow {
  return { key: r.keys[0], quotes: r.quotes, won: r.won, winRate: r.winRate, sell: r.sellInr, gp: r.gpInr, gpPct: r.sellInr > 0 ? gpPctOf(r.gpInr, r.sellInr) : null, gpBy: { won: 0, open: 0, lost: 0 }, tonnes: r.tonnes, value: 0, share: 0 };
}

export interface DrillOptions {
  /** Show only the biggest groups and fold the rest into "Others". Default 12; 0 shows all. */
  top?: number;
  /** Compare the last N months with the N months before (1, 3, 6 or 12). Leave out for no comparison. */
  compareMonths?: number;
  now?: number;
}

export function drill(allRows: EnquiryRecord[], dim: ReportDim, metric: DrillMetric, opts: DrillOptions = {}): DrillResult {
  const now = opts.now ?? Date.now();
  const top = opts.top ?? 12;
  const compareMonths = opts.compareMonths && opts.compareMonths > 0 ? opts.compareMonths : 0;
  let rows = allRows;
  let prevRows: EnquiryRecord[] = [];
  let compare: DrillResult["compare"];
  if (compareMonths) {
    const w = comparisonWindows(now, compareMonths);
    rows = allRows.filter((r) => inWindow(r, w.current));
    prevRows = allRows.filter((r) => inWindow(r, w.previous));
    compare = { months: compareMonths, currentLabel: `${mname(w.current[0])} to ${mname(now)}`, previousLabel: `${mname(w.previous[0])} to ${mname(w.current[0] - 1)}`, previousHasData: prevRows.length > 0 };
  }
  const cur = groupRows(rows, dim);
  const prev = compareMonths ? groupRows(prevRows, dim) : null;
  if (prev) for (const k of prev.keys()) if (!cur.has(k)) cur.set(k, { ...prev.get(k)!, quotes: 0, won: 0, winRate: 0, sell: 0, gp: 0, gpPct: null, gpBy: { won: 0, open: 0, lost: 0 }, tonnes: 0 });

  let list = [...cur.values()];
  const totalSum = { quotes: 0, sell: 0, gp: 0, tonnes: 0 };
  for (const r of list) {
    r.value = valueOf(r, metric);
    totalSum.quotes += r.quotes;
    totalSum.sell += r.sell;
    totalSum.gp += r.gp;
    totalSum.tonnes += r.tonnes;
    if (prev) {
      const p = prev.get(r.key);
      r.prevValue = p ? valueOf(p, metric) : 0;
      r.prevSell = p ? p.sell : 0;
      r.prevGp = p ? p.gp : 0;
      r.change = changeOf(r.value, r.prevValue, metric === "gpPct");
    }
  }
  // A quote with several lanes sits in several groups; the total counts each quote once.
  totalSum.quotes = rows.length;
  const total = valueOf(totalSum, metric);
  const prevSum = prev ? [...prev.values()].reduce((s, p) => ({ quotes: 0, sell: s.sell + p.sell, gp: s.gp + p.gp, tonnes: s.tonnes + p.tonnes }), { quotes: 0, sell: 0, gp: 0, tonnes: 0 }) : null;
  // Amounts add up; an average GP % is worked out again from the summed GP and sell, never added.
  const prevTotal = prevSum ? (metric === "quotes" ? prevRows.length : valueOf(prevSum, metric)) : undefined;

  const timeline = dim === "month";
  list.sort(timeline ? (a, b) => a.key.localeCompare(b.key) : (a, b) => b.value - a.value || a.key.localeCompare(b.key));
  if (!timeline && top > 0 && list.length > top + 1) {
    const head = list.slice(0, top);
    const rest = list.slice(top);
    const others: DrillRow = { key: `Others (${rest.length})`, quotes: 0, won: 0, winRate: 0, sell: 0, gp: 0, gpPct: null, gpBy: { won: 0, open: 0, lost: 0 }, tonnes: 0, value: 0, share: 0 };
    for (const r of rest) {
      others.quotes += r.quotes;
      others.won += r.won;
      others.sell += r.sell;
      others.gp += r.gp;
      others.tonnes += r.tonnes;
      others.value += r.value;
      others.prevSell = (others.prevSell ?? 0) + (r.prevSell ?? 0);
      others.prevGp = (others.prevGp ?? 0) + (r.prevGp ?? 0);
      (Object.keys(others.gpBy) as GpTone[]).forEach((t) => (others.gpBy[t] += r.gpBy[t]));
      if (prev) others.prevValue = (others.prevValue ?? 0) + (r.prevValue ?? 0);
    }
    others.winRate = others.quotes ? others.won / others.quotes : 0;
    others.gpPct = others.sell > 0 ? gpPctOf(others.gp, others.sell) : null;
    if (metric === "gpPct") {
      others.value = valueOf(others, metric);
      if (prev) others.prevValue = valueOf({ quotes: 0, sell: others.prevSell ?? 0, gp: others.prevGp ?? 0, tonnes: 0 }, metric);
    }
    if (prev) others.change = changeOf(others.value, others.prevValue ?? 0, metric === "gpPct");
    list = [...head, others];
  }
  // A share of an average means nothing: only amounts have one.
  for (const r of list) r.share = metric === "gpPct" ? 0 : total > 0 ? r.value / total : 0;

  return {
    rows: list,
    total: { ...totalSum, value: total, prevValue: prevTotal, change: prev ? changeOf(total, prevTotal ?? 0) : undefined },
    compare,
  };
}

/** The Enquiry DB filter a click on a drill row should apply. Only filters that exist on the screen are returned. */
export type DrillFilter =
  | { kind: "mode"; value: string }
  | { kind: "desk"; value: string }
  | { kind: "customer"; value: string }
  | { kind: "carrier"; value: string }
  | { kind: "month"; from: string; to: string }
  | { kind: "none" };

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function filterForDrillRow(dim: ReportDim, key: string, seatIdByLabel?: Record<string, string>): DrillFilter {
  if (/^Others \(/.test(key) || key === "—" || !key) return { kind: "none" };
  switch (dim) {
    case "mode":
      return { kind: "mode", value: key.toLowerCase() };
    case "customer":
      return { kind: "customer", value: key };
    case "carrier":
      return { kind: "carrier", value: key };
    case "seat": {
      const id = seatIdByLabel?.[key];
      return id ? { kind: "desk", value: id } : { kind: "none" };
    }
    case "month": {
      // Period keys look like "2026-10" (sortable); accept "Oct 2026" too.
      const m = /^(\d{4})-(\d{2})/.exec(key);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        return { kind: "month", from: ymd(new Date(y, mo, 1)), to: ymd(new Date(y, mo + 1, 0)) };
      }
      const t = /^([A-Za-z]{3})\w*\s+(\d{4})$/.exec(key);
      if (t && MONTHS[t[1].toLowerCase()] != null) {
        const y = Number(t[2]);
        const mo = MONTHS[t[1].toLowerCase()];
        return { kind: "month", from: ymd(new Date(y, mo, 1)), to: ymd(new Date(y, mo + 1, 0)) };
      }
      return { kind: "none" };
    }
    default:
      return { kind: "none" };
  }
}
