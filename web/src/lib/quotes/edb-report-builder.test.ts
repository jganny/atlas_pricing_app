import assert from "node:assert/strict";
import { billingTonnes, buildReport, explodeFacts, reportToCsv, tonnageBand } from "./edb-report-builder";
import type { EnquiryRecord } from "../types";

function row(p: Partial<EnquiryRecord>): EnquiryRecord {
  return {
    id: "q",
    ref: "R",
    customer: "Acme",
    mode: "air",
    origin: "BOM - Mumbai",
    destination: "LHR - London",
    status: "quoted",
    slaHoursOpen: 0,
    assignee: "",
    creator: "ganny",
    createdAt: "2026-09-10",
    grandTotal: 1000,
    currency: "INR",
    carrier: "EK",
    billingWeight: 500,
    billingUnit: "kg",
    ...p,
  };
}

// tonnage
assert.equal(billingTonnes({ billingWeight: 500, billingUnit: "kg" }), 0.5);
assert.equal(billingTonnes({ billingWeight: 12, billingUnit: "rt" }), 12);
assert.equal(billingTonnes({}), null);
assert.equal(tonnageBand(0.05), "< 0.1 t");
assert.equal(tonnageBand(0.5), "0.5 – 1 t");
assert.equal(tonnageBand(25), "20 t +");
assert.equal(tonnageBand(null), "No weight");

// group by carrier: counts, wins, sums
const rows = [
  row({ id: "1", carrier: "EK", grandTotal: 1000, status: "won", legs: [{ origin: "BOM", destination: "LHR", carrier: "EK", kind: "airline" }] }),
  row({ id: "2", carrier: "EK", grandTotal: 500, legs: [{ origin: "BOM", destination: "LHR", carrier: "EK", kind: "airline" }] }),
  row({ id: "3", carrier: "TK", grandTotal: 300, legs: [{ origin: "BOM", destination: "IST", carrier: "TK", kind: "coloader" }] }),
];
const byCarrier = buildReport(rows, ["carrier"], "sell");
assert.deepEqual(byCarrier.map((r) => r.keys[0]), ["EK", "TK"]);
assert.equal(byCarrier[0]!.quotes, 2);
assert.equal(byCarrier[0]!.won, 1);
assert.equal(byCarrier[0]!.winRate, 0.5);
assert.equal(byCarrier[0]!.sellInr, 1500);

// combination: carrier type x POD
const combo = buildReport(rows, ["carrierKind", "pod"], "key");
assert.deepEqual(combo.map((r) => r.keys.join("|")), ["Airline|LHR", "Coloader|IST"]);

// carrier-kind filter
const coloaders = buildReport(rows, ["carrier"], "sell", { carrierKind: "coloader" });
assert.deepEqual(coloaders.map((r) => r.keys[0]), ["TK"]);

// multi-lane quote: one fact per lane, revenue split by lane amount, quote counted once per group
const multi = row({
  id: "m",
  grandTotal: 1000,
  legs: [
    { origin: "BOM", destination: "LHR", carrier: "EK", kind: "airline", amount: 750 },
    { origin: "BLR", destination: "LHR", carrier: "TK", kind: "coloader", amount: 250 },
  ],
});
assert.equal(explodeFacts([multi]).length, 2);
const byPol = buildReport([multi], ["pol"], "key");
assert.deepEqual(byPol.map((r) => [r.keys[0], Math.round(r.sellInr)]), [["BLR", 250], ["BOM", 750]]);
const byPod = buildReport([multi], ["pod"], "key");
assert.equal(byPod.length, 1);
assert.equal(byPod[0]!.quotes, 1); // both lanes go to LHR but it's one quote
assert.equal(Math.round(byPod[0]!.sellInr), 1000);

// rows with no legs fall back to record fields
const legacy = buildReport([row({ id: "z", legs: undefined, carrier: "QR" })], ["carrier", "carrierKind"], "key");
assert.deepEqual(legacy[0]!.keys, ["QR", "Airline"]);

// csv
const csv = reportToCsv(byCarrier, ["carrier"]);
assert.ok(csv.startsWith("Carrier,Quotes,Won,Win rate %,Sell (INR),GP (INR),Tonnes"));
assert.ok(csv.includes("EK,2,1,50.0,1500"));

// period dimensions: group by month / week, combine with carrier
const at = (m: number, d: number) => new Date(2026, m - 1, d, 12).getTime();
const dated = [
  row({ id: "p1", createdAt: String(at(8, 30)), carrier: "EK", grandTotal: 100, legs: [{ origin: "BOM", destination: "LHR", carrier: "EK", kind: "airline" }] }),
  row({ id: "p2", createdAt: String(at(9, 1)), carrier: "EK", grandTotal: 200, legs: [{ origin: "BOM", destination: "LHR", carrier: "EK", kind: "airline" }] }),
  row({ id: "p3", createdAt: String(at(9, 2)), carrier: "TK", grandTotal: 400, legs: [{ origin: "BOM", destination: "IST", carrier: "TK", kind: "airline" }] }),
];
const byMonth = buildReport(dated, ["month"], "key");
assert.deepEqual(byMonth.map((r) => [r.keys[0], r.quotes, Math.round(r.sellInr)]), [["2026-08", 1, 100], ["2026-09", 2, 600]]);
const byWeek = buildReport(dated, ["week"], "key");
assert.deepEqual(byWeek.map((r) => r.keys[0]), ["Week of 2026-08-24", "Week of 2026-08-31"]);
const carrierMonth = buildReport(dated, ["carrier", "month"], "key");
assert.deepEqual(carrierMonth.map((r) => r.keys.join("|")), ["EK|2026-08", "EK|2026-09", "TK|2026-09"]);
assert.deepEqual(buildReport(dated, ["fy"], "key").map((r) => r.keys[0]), ["FY 2026-27"]);
assert.ok(reportToCsv(byMonth, ["month"]).startsWith("Period: Month,Quotes"));

// seat rollup: quotes by the same desk seat group together (default login "kavya" -> Free Hand)
const bySeat = buildReport(
  [row({ id: "s1", creator: "kavya", grandTotal: 100 }), row({ id: "s2", creator: "jaya", grandTotal: 50 }), row({ id: "s3", creator: "shashank", grandTotal: 10 })],
  ["seat"],
  "key",
);
assert.deepEqual(bySeat.map((r) => [r.keys[0], r.quotes]), [["Air Nom", 1], ["Free Hand", 2]]);

console.log("edb-report-builder.test.ts: all assertions passed");
