import assert from "node:assert/strict";
import { comparisonWindows, drill, filterForDrillRow, gpPctOf } from "./edb-drill";
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

// ---- average GP % by user ----
{
  const mk = (id: string, creator: string, sell: number, gp: number, month = "2026-10-10", status: EnquiryRecord["status"] = "won") =>
    row({ id, creator, grandTotal: sell, grossProfit: gp, createdAt: month, status, customer: `C${id}` });
  const data = [
    mk("a1", "shashank", 10000, 1000),
    mk("a2", "shashank", 30000, 1500), // 2500 on 40000 = 6.25% weighted (a plain average of 10% and 5% would say 7.5%)
    mk("b1", "shaheer", 20000, 2000), // 10%
    mk("c1", "cathrina", 5000, 0), // no profit at all: 0%
  ];
  const r = drill(data, "desk", "gpPct", { now: NOW, top: 0 });
  const by = Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
  const shashank = r.rows.find((x) => /shashank|Shashank|Air/i.test(x.key));
  assert.ok(shashank, "a row for each user");
  assert.equal(shashank!.value, 6.25, "weighted: total GP over total sell, not the average of the percentages");
  assert.equal(r.rows.find((x) => x.value === 10)?.quotes, 1);
  assert.equal(r.rows[r.rows.length - 1].value, 0, "lowest last");
  assert.equal(r.total.value, Math.round((4500 / 65000) * 10_000) / 100, "the overall average is worked out from the totals");
  assert.ok(r.rows.every((x) => x.share === 0), "a share of an average means nothing");
  assert.ok(Object.keys(by).length === 3, "three users");

  // Compared with the period before, the change is in percentage POINTS, and a group with nothing before has no change.
  const prevData = [mk("p1", "shashank", 10000, 500, "2026-06-10")]; // 5% in the earlier months
  const cmp = drill([...data, ...prevData], "desk", "gpPct", { now: NOW, top: 0, compareMonths: 3 });
  const sh = cmp.rows.find((x) => /shashank|Shashank|Air/i.test(x.key))!;
  assert.equal(sh.prevValue, 5);
  assert.equal(sh.change, 1.25, "6.25% now against 5% before = up 1.25 points");
  assert.equal(cmp.rows.find((x) => x.value === 10)?.change, null);

  // Folding small groups into "Others" keeps a true weighted average.
  const folded = drill(data, "desk", "gpPct", { now: NOW, top: 1 });
  const others = folded.rows.find((x) => /^Others/.test(x.key))!;
  assert.ok(others, "the rest are folded");
  assert.ok(Math.abs(others.value - gpPctOf(others.gp, others.sell)) < 1e-9);
  console.log("average GP % tests passed");
}

console.log("edb-drill tests passed");
