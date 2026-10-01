import type { EnquiryRecord } from "@/lib/types";

/** Time granularities a report can be grouped by (all local time, Monday-start weeks). */
export type PeriodGranularity = "day" | "week" | "fortnight" | "month" | "quarter" | "fy" | "year";

export const PERIOD_GRANULARITIES: Array<{ id: PeriodGranularity; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "fortnight", label: "Fortnight (1–15 / 16–end)" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter (calendar)" },
  { id: "fy", label: "Financial year (Apr–Mar)" },
  { id: "year", label: "Calendar year" },
];

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function parseCreatedAt(createdAt?: string): number | null {
  if (!createdAt) return null;
  const n = Number(createdAt);
  const t = Number.isFinite(n) && n > 1e11 ? n : Date.parse(createdAt);
  return Number.isFinite(t) ? t : null;
}

/**
 * Sortable label for the period a timestamp falls in. Labels sort
 * chronologically as plain text, so "Name (A–Z)" ordering reads as a timeline.
 */
export function periodKey(time: number | null, g: PeriodGranularity): string {
  if (time == null) return "Undated";
  const d = new Date(time);
  switch (g) {
    case "day":
      return ymd(d);
    case "week": {
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      return `Week of ${ymd(monday)}`;
    }
    case "fortnight":
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)} ${d.getDate() <= 15 ? "(1–15)" : "(16–end)"}`;
    case "month":
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    case "quarter":
      return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    case "fy": {
      const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`;
    }
    case "year":
      return String(d.getFullYear());
  }
}

export type RangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-fortnight"
  | "last-fortnight"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-fy"
  | "last-fy"
  | "this-year"
  | "last-year"
  | "custom";

export const RANGE_PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: "all", label: "All dates in view" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week (completed)" },
  { id: "this-fortnight", label: "This fortnight" },
  { id: "last-fortnight", label: "Last fortnight (completed)" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month (completed)" },
  { id: "this-quarter", label: "This quarter" },
  { id: "last-quarter", label: "Last quarter (completed)" },
  { id: "this-fy", label: "This financial year" },
  { id: "last-fy", label: "Last financial year (completed)" },
  { id: "this-year", label: "This calendar year" },
  { id: "last-year", label: "Last calendar year (completed)" },
  { id: "custom", label: "Custom dates…" },
];

export interface DateRange {
  /** Inclusive. */
  start: number;
  /** Exclusive. */
  end: number;
  label: string;
}

/** [start, end) in local time for a preset; null for "all" / unresolved custom. */
export function rangeForPreset(preset: RangePreset, now: number = Date.now(), custom?: { from?: string; to?: string }): DateRange | null {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const mk = (s: Date, e: Date, label: string): DateRange => ({ start: s.getTime(), end: e.getTime(), label });
  switch (preset) {
    case "all":
      return null;
    case "today":
      return mk(new Date(y, m, day), new Date(y, m, day + 1), "Today");
    case "yesterday":
      return mk(new Date(y, m, day - 1), new Date(y, m, day), "Yesterday");
    case "this-week":
    case "last-week": {
      const monday = day - ((d.getDay() + 6) % 7) - (preset === "last-week" ? 7 : 0);
      const s = new Date(y, m, monday);
      return mk(s, new Date(y, m, monday + 7), `Week of ${ymd(s)}`);
    }
    case "this-fortnight":
    case "last-fortnight": {
      const firstHalf = day <= 15;
      let s = new Date(y, m, firstHalf ? 1 : 16);
      let e = new Date(y, firstHalf ? m : m + 1, firstHalf ? 16 : 1);
      if (preset === "last-fortnight") {
        s = new Date(y, firstHalf ? m - 1 : m, firstHalf ? 16 : 1);
        e = new Date(y, m, firstHalf ? 1 : 16);
      }
      return mk(s, e, `Fortnight ${ymd(s)} → ${ymd(new Date(e.getTime() - 1))}`);
    }
    case "this-month":
    case "last-month": {
      const off = preset === "last-month" ? -1 : 0;
      const s = new Date(y, m + off, 1);
      return mk(s, new Date(y, m + off + 1, 1), `${s.getFullYear()}-${p2(s.getMonth() + 1)}`);
    }
    case "this-quarter":
    case "last-quarter": {
      const q = Math.floor(m / 3) + (preset === "last-quarter" ? -1 : 0);
      const s = new Date(y, q * 3, 1);
      return mk(s, new Date(y, q * 3 + 3, 1), `${s.getFullYear()}-Q${Math.floor(s.getMonth() / 3) + 1}`);
    }
    case "this-fy":
    case "last-fy": {
      const start = (m >= 3 ? y : y - 1) - (preset === "last-fy" ? 1 : 0);
      return mk(new Date(start, 3, 1), new Date(start + 1, 3, 1), `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`);
    }
    case "this-year":
    case "last-year": {
      const yy = y - (preset === "last-year" ? 1 : 0);
      return mk(new Date(yy, 0, 1), new Date(yy + 1, 0, 1), String(yy));
    }
    case "custom": {
      if (!custom?.from || !custom?.to) return null;
      const [fy, fm, fd] = custom.from.split("-").map(Number);
      const [ty, tm, td] = custom.to.split("-").map(Number);
      if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return null;
      const s = new Date(fy!, fm! - 1, fd!);
      const e = new Date(ty!, tm! - 1, td! + 1); // "to" date is inclusive
      if (e.getTime() <= s.getTime()) return null;
      return mk(s, e, `${custom.from} → ${custom.to}`);
    }
  }
}

/** Rows created inside the range; undated rows are excluded from any real range. */
export function filterByRange(rows: EnquiryRecord[], range: DateRange | null): EnquiryRecord[] {
  if (!range) return rows;
  return rows.filter((r) => {
    const t = parseCreatedAt(r.createdAt);
    return t != null && t >= range.start && t < range.end;
  });
}
