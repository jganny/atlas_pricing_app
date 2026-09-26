import assert from "node:assert/strict";
import { filterByRange, periodKey, rangeForPreset } from "./report-periods";
import type { EnquiryRecord } from "../types";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime(); // local noon-ish, TZ-safe

// keys
assert.equal(periodKey(at(2026, 9, 20), "day"), "2026-09-20");
assert.equal(periodKey(at(2026, 9, 20), "week"), "Week of 2026-09-14"); // Sunday belongs to the Mon-start week
assert.equal(periodKey(at(2026, 9, 14), "week"), "Week of 2026-09-14");
assert.equal(periodKey(at(2026, 9, 21), "week"), "Week of 2026-09-21");
assert.equal(periodKey(at(2026, 9, 15), "fortnight"), "2026-09 (1–15)");
assert.equal(periodKey(at(2026, 9, 16), "fortnight"), "2026-09 (16–end)");
assert.equal(periodKey(at(2026, 9, 20), "month"), "2026-09");
assert.equal(periodKey(at(2026, 9, 20), "quarter"), "2026-Q3");
assert.equal(periodKey(at(2027, 3, 31), "fy"), "FY 2026-27");
assert.equal(periodKey(at(2027, 4, 1), "fy"), "FY 2027-28");
assert.equal(periodKey(at(2026, 1, 2), "year"), "2026");
assert.equal(periodKey(null, "month"), "Undated");
// keys sort chronologically as text
assert.deepEqual(["2026-10", "2026-09", "2026-02"].sort(), ["2026-02", "2026-09", "2026-10"]);
// local-time correctness: 00:30 on the 1st stays in that month (a UTC slice would push IST users to the previous one)
assert.equal(periodKey(new Date(2026, 8, 1, 0, 30).getTime(), "month"), "2026-09");

// ranges (now = Sun 20 Sep 2026)
const now = at(2026, 9, 20);
const r = (p: Parameters<typeof rangeForPreset>[0]) => rangeForPreset(p, now)!;
assert.equal(rangeForPreset("all", now), null);
assert.equal(r("today").start, new Date(2026, 8, 20).getTime());
assert.equal(r("yesterday").end, new Date(2026, 8, 20).getTime());
assert.equal(r("this-week").start, new Date(2026, 8, 14).getTime());
assert.equal(r("last-week").start, new Date(2026, 8, 7).getTime());
assert.equal(r("last-week").end, new Date(2026, 8, 14).getTime());
assert.equal(r("this-fortnight").start, new Date(2026, 8, 16).getTime());
assert.equal(r("this-fortnight").end, new Date(2026, 9, 1).getTime());
assert.equal(r("last-fortnight").start, new Date(2026, 8, 1).getTime());
assert.equal(r("last-fortnight").end, new Date(2026, 8, 16).getTime());
assert.equal(r("last-month").start, new Date(2026, 7, 1).getTime());
assert.equal(r("last-month").end, new Date(2026, 8, 1).getTime());
assert.equal(r("this-quarter").start, new Date(2026, 6, 1).getTime());
assert.equal(r("last-quarter").start, new Date(2026, 3, 1).getTime());
assert.equal(r("last-quarter").end, new Date(2026, 6, 1).getTime());
assert.equal(r("this-fy").start, new Date(2026, 3, 1).getTime());
assert.equal(r("last-fy").start, new Date(2025, 3, 1).getTime());
assert.equal(r("last-fy").end, new Date(2026, 3, 1).getTime());
assert.equal(r("last-year").start, new Date(2025, 0, 1).getTime());
assert.equal(r("this-year").end, new Date(2027, 0, 1).getTime());
// early-in-fortnight / January edge cases
const jan5 = at(2026, 1, 5);
assert.equal(rangeForPreset("last-fortnight", jan5)!.start, new Date(2025, 11, 16).getTime());
assert.equal(rangeForPreset("last-month", jan5)!.start, new Date(2025, 11, 1).getTime());
assert.equal(rangeForPreset("last-quarter", jan5)!.start, new Date(2025, 9, 1).getTime());
assert.equal(rangeForPreset("last-fy", at(2026, 2, 1))!.start, new Date(2024, 3, 1).getTime()); // Feb 2026 is FY25-26
// custom: "to" is inclusive, bad input rejected
const c = rangeForPreset("custom", now, { from: "2026-09-01", to: "2026-09-30" })!;
assert.equal(c.end, new Date(2026, 9, 1).getTime());
assert.equal(rangeForPreset("custom", now, { from: "2026-09-30", to: "2026-09-01" }), null);
assert.equal(rangeForPreset("custom", now, {}), null);

// filtering
const row = (id: string, createdAt: string): EnquiryRecord => ({
  id, ref: id, customer: "A", mode: "air", origin: "", destination: "", status: "quoted",
  slaHoursOpen: 0, assignee: "", creator: "", createdAt,
});
const rows = [row("in", String(at(2026, 8, 15))), row("out", String(at(2026, 9, 1))), row("undated", ""), row("edge", String(new Date(2026, 7, 1).getTime()))];
const aug = rangeForPreset("last-month", now)!;
assert.deepEqual(filterByRange(rows, aug).map((x) => x.id), ["in", "edge"]);
assert.equal(filterByRange(rows, null).length, 4);

console.log("report-periods.test.ts: all assertions passed");
