import assert from "node:assert/strict";
import type { SavedQuote } from "@/lib/types";
import { optionBreakdownsFromQuote, optionChargeLines } from "./option-breakdown";
import { formatSellCell } from "./edb-metrics";
import type { EnquiryRecord } from "@/lib/types";

// AEUGS0826IN00478, as the older app saved it: the Minimum break holds a flat $405, charges use `rate`/`buyRate`,
// the option total is `grandTotal`, and the "applied rate" is the minimum amount itself.
const aeugs: SavedQuote = {
  id: "Q80tdieob1", customer: "UGS", creator: "shashank", status: "quoted", type: "air", currency: "USD", amount: 716, date: "2026-08-12",
  details: {
    origin: "BOM", destination: "ISB", incoterm: "EXW", dimUnit: "cms", chargeableWeight: 15, appliedRate: 405, baseFreight: 405,
    cargoItems: [{ l: 34, w: 34, h: 53, qty: 1, gw: 15 }],
    airlines: [
      {
        id: "a1", name: "GF - Gulf Air Bahrain", routing: "via BAH", tt: "3 Days", validity: "2026-08-19", selected: true, wbEnabled: true,
        originFeesEnabled: true, destFeesEnabled: true, amsFee: 30, amsFeeEnabled: true, breaks: { min: { sell: 405, buy: 0 } },
        originSurcharges: [
          { name: "Cartage", rate: 6, buyRate: 4, unit: "flat", remarks: "", calculatedCost: 6 },
          { name: "DG", rate: 100, buyRate: 0, unit: "flat", remarks: "", calculatedCost: 100 },
          { name: "Handling", rate: 175, buyRate: 0, unit: "flat", remarks: "", calculatedCost: 175 },
          { name: "AMS Fee", rate: 30, unit: "flat", calculatedCost: 30 },
        ],
        destSurcharges: [], grandTotal: 716,
      },
    ],
  },
};

const [opt] = optionBreakdownsFromQuote(aeugs);
assert.ok(opt, "the option is found");
const lines = optionChargeLines(opt, "USD", 15);
const text = lines.map((l) => `${l.label}: ${l.value}`);
assert.deepEqual(text, [
  "Base freight (minimum charge): $405.00",
  "Cartage: $6.00",
  "DG: $100.00",
  "Handling: $175.00",
  "AMS: $30.00",
  "Option total: $716.00",
], "the customer sees the minimum charge as a flat charge, every charge itemised, and a total that adds up");
const sum = [405, 6, 100, 175, 30].reduce((a, b) => a + b, 0);
assert.equal(sum, 716, "and the lines add up to the quoted total");
assert.ok(!text.some((t) => /kg ×/.test(t)), "a flat minimum is never printed as kg × rate");
assert.ok(!text.some((t) => /from Buy/.test(t)), "the customer copy never says (from Buy)");

// A normal per-kg quote keeps its working
const normal: SavedQuote = {
  id: "Q1", customer: "N", creator: "x", status: "quoted", type: "air", currency: "INR", amount: 25200, date: "2026-10-28",
  details: { dimUnit: "cms", chargeableWeight: 70, appliedRate: 360, cargoItems: [{ l: 100, w: 70, h: 60, qty: 1, gw: 70 }],
    airlines: [{ id: "a1", name: "6E", selected: true, wbEnabled: true, breaks: { plus45: { sell: 360, buy: 0 } }, originSurcharges: [], destSurcharges: [] }] },
};
const [nopt] = optionBreakdownsFromQuote(normal);
assert.equal(optionChargeLines(nopt, "INR", 70)[0].value, "70.00 kg × ₹360.00 = ₹25,200.00", "a real per-kg rate still shows weight × rate = total, in the quote's currency");

// "(from Buy)" is shown on the internal screen only
const buyOnly: SavedQuote = { ...normal, id: "Q2", details: { ...normal.details, airlines: [{ id: "a1", name: "6E", selected: true, wbEnabled: true, breaks: { plus45: { sell: 0, buy: 360 } }, originSurcharges: [], destSurcharges: [] }] } };
const [bopt] = optionBreakdownsFromQuote(buyOnly);
assert.ok(/from Buy/.test(optionChargeLines(bopt, "INR", 70, { showCostMarker: true })[0].value));
assert.ok(!/from Buy/.test(optionChargeLines(bopt, "INR", 70)[0].value));

// Enquiry DB: a flat minimum stored as the "rate" is not shown as $405 per kg
const row = { mode: "air", currency: "USD", grandTotal: 716, appliedRate: 405, billingWeight: 15, status: "quoted" } as EnquiryRecord;
assert.equal(formatSellCell(row, "perkg"), "$405.00 (Min)");
assert.equal(formatSellCell({ ...row, grandTotal: 5400, appliedRate: 3.9, billingWeight: 1000 }, "perkg"), "$3.90/kg", "a real per-kg rate is untouched");
console.log("legacy-quote-breakdown tests passed");
