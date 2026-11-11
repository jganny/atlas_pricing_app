import assert from "node:assert/strict";
import { comparisonWindows, drill, filterForDrillRow } from "./edb-drill";
import type { EnquiryRecord } from "../types";

const NOW = Date.parse("2026-11-11T10:00:00");
function row(p: Partial<EnquiryRecord>): EnquiryRecord {
  return { id: "q", ref: "R", customer: "Acme", mode: "air", origin: "BOM", destination: "LHR", status: "quoted", slaHoursOpen: 0, assignee: "", creator: "ganny", createdAt: "2026-10-10", grandTotal: 1000, currency: "INR", grossProfit: 100, carrier: "EK", billingWeight: 500, billingUnit: "kg", ...p };
}
const rows = [
  row({ id: "1", customer: "Acme", status: "won", grandTotal: 3000, grossProfit: 300, createdAt: "2026-10-05" }),
  row({ id: "2", customer: "Acme", status: "lost", grandTotal: 1000, grossProfit: 100, createdAt: "2026-10-20" }),
  row({ id: "3", customer: "Beta", status: "quoted", grandTotal: 2000, grossProfit: 200, createdAt: "2026-09-15" }),
  row({ id: "4", customer: "Beta", status: "won", grandTotal: 1000, grossProfit: 50, createdAt: "2026-05-01" }), // outside a 3-month window
  row({ id: "5", customer: "Beta", status: "won", grandTotal: 500, grossProfit: 50, createdAt: "2026-07-20" }), // previous 3 months
];

// Group by customer, ordered by the chosen number, with shares and GP split by what it means.
const r = drill(rows, "customer", "sell", { now: NOW });
assert.deepEqual(r.rows.map((x) => x.key), ["Acme", "Beta"]);
assert.equal(r.total.sell, 7500);
const acme = r.rows.find((x) => x.key === "Acme")!;
assert.equal(acme.sell, 4000);
assert.equal(acme.quotes, 2);
assert.equal(acme.winRate, 0.5);
assert.deepEqual(acme.gpBy, { won: 300, open: 0, lost: 100 });
assert.ok(Math.abs(r.rows.reduce((s, x) => s + x.share, 0) - 1) < 1e-9, "shares add to 100%");

// The GP number is the sum of its three meanings.
for (const g of r.rows) assert.equal(g.gp, g.gpBy.won + g.gpBy.open + g.gpBy.lost);

// Months run oldest to newest, not by size.
assert.deepEqual(drill(rows, "month", "quotes", { now: NOW }).rows.map((x) => x.key), ["2026-05", "2026-07", "2026-09", "2026-10"]);

// Only the biggest groups are shown; the rest fold into "Others", and nothing is lost.
const many = Array.from({ length: 6 }, (_, i) => row({ id: `m${i}`, customer: `C${i}`, grandTotal: 100 * (i + 1), grossProfit: 10 }));
const top = drill(many, "customer", "sell", { top: 3, now: NOW });
assert.equal(top.rows.length, 4);
assert.match(top.rows[3].key, /^Others \(3\)$/);
assert.equal(top.rows.reduce((s, x) => s + x.sell, 0), 2100);

// Comparison: the last 3 months against the 3 months before.
const w = comparisonWindows(NOW, 3);
assert.ok(w.current[0] > w.previous[0] && w.previous[1] === w.current[0]);
const cmp = drill(rows, "customer", "sell", { now: NOW, compareMonths: 3 });
assert.equal(cmp.compare?.previousHasData, true);
const beta = cmp.rows.find((x) => x.key === "Beta")!;
assert.equal(beta.value, 2000); // Sep quote only: the May one is outside both windows
assert.equal(beta.prevValue, 500);
assert.equal(beta.change, 3); // up 300%
assert.equal(cmp.total.value, 6000);
assert.equal(cmp.total.prevValue, 500);
// A customer with nothing in the earlier period has no percentage, not a wrong one.
assert.equal(cmp.rows.find((x) => x.key === "Acme")!.change, null);
assert.equal(drill(rows, "customer", "sell", { now: NOW }).compare, undefined);

// A click turns into the filter the screen already has.
assert.deepEqual(filterForDrillRow("mode", "AIR"), { kind: "mode", value: "air" });
assert.deepEqual(filterForDrillRow("customer", "Acme"), { kind: "customer", value: "Acme" });
assert.deepEqual(filterForDrillRow("month", "2026-02"), { kind: "month", from: "2026-02-01", to: "2026-02-28" });
assert.deepEqual(filterForDrillRow("seat", "NRS", { NRS: "seat:nrs" }), { kind: "desk", value: "seat:nrs" });
assert.deepEqual(filterForDrillRow("customer", "Others (3)"), { kind: "none" });
assert.deepEqual(filterForDrillRow("status", "won"), { kind: "none" });

console.log("edb-drill tests passed");
