import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import { optionBreakdownsFromQuote, optionChargeLines } from "./option-breakdown";
import { buildClientQuoteDocument } from "./quote-document";

// A courier quote whose freight goes by courier but clearance at origin and destination is under cargo mode.
const quote: SavedQuote = {
  id: "c1",
  customer: "Acme",
  creator: "ganny",
  status: "quoted",
  type: "courier",
  amount: 1000,
  currency: "INR",
  route: "BLR → DXB",
  date: "2026-10-08",
  details: {
    chargeableWeight: 10,
    gstAmount: 0,
    localOriginCharges: [
      { id: "o1", name: "Origin handling", sell: 200, buy: 150, unit: "flat", remarks: "" },
      { id: "o2", name: "Origin pickup", sell: 5, buy: 3, unit: "kg", remarks: "" },
    ],
    destClearanceCharges: [{ id: "d1", name: "Destination clearance", sell: 300, buy: 250, unit: "flat", remarks: "" }],
    carrierQuotes: [
      { id: "dhl", name: "DHL", kind: "courier", selected: true, quoteTotal: 1000, baseFreight: 450, localOriginTotal: 250, destClearanceTotal: 300 },
      { id: "fdx", name: "FedEx", kind: "courier", selected: false, quoteTotal: 1200, baseFreight: 650, localOriginTotal: 250, destClearanceTotal: 300 },
    ],
  },
};

const dhl = optionBreakdownsFromQuote(quote).find((o) => o.id === "dhl")!;
assert.equal(dhl.localOriginFees, 250);
assert.equal(dhl.destClearanceFees, 300);
// Each charge is itemised the way Air/Sea quotes do: flat as-is, per-kg × the chargeable weight.
assert.deepEqual(dhl.localOriginLines.map((l) => [l.name, l.amount]), [["Origin handling", 200], ["Origin pickup", 50]]);
assert.deepEqual(dhl.destClearanceLines.map((l) => [l.name, l.amount]), [["Destination clearance", 300]]);

const labels = optionChargeLines(dhl, "INR", 10).map((l) => l.label);
for (const want of ["Origin handling", "Origin pickup", "Destination clearance", "Option total"]) assert.equal(labels.includes(want), true, want);

// They reach the customer's copy, and the cheaper courier is still listed first.
const doc = buildClientQuoteDocument(quote);
assert.match(doc.html, /Origin handling/);
assert.match(doc.html, /Destination clearance/);
assert.ok(doc.html.indexOf("<h3>DHL") < doc.html.indexOf("<h3>FedEx"));

// A courier quote with no end charges looks exactly as before.
const plain = optionBreakdownsFromQuote({
  ...quote,
  details: { ...quote.details, localOriginCharges: [], destClearanceCharges: [], carrierQuotes: [{ id: "dhl", name: "DHL", kind: "courier", selected: true, quoteTotal: 450, baseFreight: 450 }] },
})[0];
assert.equal(plain.localOriginLines.length + plain.destClearanceLines.length, 0);

console.log("courier-end-charges.test.ts: all assertions passed");
