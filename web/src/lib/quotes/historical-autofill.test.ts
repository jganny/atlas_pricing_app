import assert from "node:assert/strict";
import {
  extractCourierCharges,
  extractTransportCharges,
  extractWarehouseCharges,
  normalizeSurchargeName,
  pickConsistentValue,
  selectCandidateIds,
  withinLookbackDays,
  type HistoricalMatchFilter,
} from "./historical-autofill";
import type { EnquiryRecord, SavedQuote } from "../types";

// pickConsistentValue — n=2 requires exact agreement
assert.equal(pickConsistentValue([{ value: 50, timestamp: 1 }, { value: 50, timestamp: 2 }]), 50);
assert.equal(pickConsistentValue([{ value: 50, timestamp: 1 }, { value: 55, timestamp: 2 }]), null);
assert.equal(pickConsistentValue([{ value: 50, timestamp: 1 }]), null); // below minimum sample count

// n>=3 — mode must cover >=70%, ties broken by most recent
assert.equal(
  pickConsistentValue([
    { value: 50, timestamp: 1 },
    { value: 50, timestamp: 2 },
    { value: 50, timestamp: 3 },
  ]),
  50,
);
assert.equal(
  pickConsistentValue([
    { value: 50, timestamp: 1 },
    { value: 55, timestamp: 2 },
    { value: 60, timestamp: 3 },
  ]),
  null, // no value reaches 70% of 3 samples
);
assert.equal(
  pickConsistentValue([
    { value: 50, timestamp: 1 },
    { value: 50, timestamp: 2 },
    { value: 50, timestamp: 3 },
    { value: 55, timestamp: 4 },
  ]),
  50, // 3/4 = 75% >= 70%
);
assert.equal(
  pickConsistentValue([
    { value: 50.001, timestamp: 1 },
    { value: 50.004, timestamp: 2 },
  ]),
  50, // both round to 50.00
);

// normalizeSurchargeName — case/whitespace insensitive
assert.equal(normalizeSurchargeName("  Xray  "), "xray");
assert.equal(normalizeSurchargeName("Destination   THC"), "destination thc");

// withinLookbackDays — boundary at exactly N days
const now = Date.parse("2026-09-16T00:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
assert.equal(withinLookbackDays(now - 365 * dayMs, 365, now), true);
assert.equal(withinLookbackDays(now - 366 * dayMs, 365, now), false);
assert.equal(withinLookbackDays(undefined, 365, now), false);

// selectCandidateIds — desk type / O-D / currency / recency filtering, same-customer ranked first
const baseFilter: HistoricalMatchFilter = {
  deskType: "air",
  origin: "BOM",
  destination: "LHR",
  incoterm: "FOB",
  currency: "USD",
  module: "export",
  customer: "Acme",
};
function enquiry(partial: Partial<EnquiryRecord>): EnquiryRecord {
  return {
    id: "x",
    ref: "R",
    customer: "Other",
    mode: "air",
    origin: "BOM",
    destination: "LHR",
    status: "quoted",
    slaHoursOpen: 0,
    assignee: "",
    creator: "",
    createdAt: String(now),
    currency: "USD",
    ...partial,
  };
}
const candidates = selectCandidateIds(
  [
    enquiry({ id: "same-customer", customer: "Acme" }),
    enquiry({ id: "other-customer" }),
    enquiry({ id: "wrong-route", origin: "DEL" }),
    enquiry({ id: "wrong-currency", currency: "EUR" }),
    enquiry({ id: "wrong-desk", mode: "sea" }),
    enquiry({ id: "stale", createdAt: String(now - 400 * dayMs) }),
  ],
  baseFilter,
  365,
  25,
  now,
);
assert.deepEqual(candidates, ["same-customer", "other-customer"]);

// selectCandidateIds — Courier/Transport/Warehouse don't require an incoterm
const courierCandidates = selectCandidateIds(
  [enquiry({ id: "courier-1", mode: "courier" })],
  { deskType: "courier", origin: "BOM", destination: "LHR", currency: "USD" },
  365,
  25,
  now,
);
assert.deepEqual(courierCandidates, ["courier-1"]);

// selectCandidateIds — Warehouse matches with an empty destination
const warehouseCandidates = selectCandidateIds(
  [enquiry({ id: "wh-1", mode: "warehouse", origin: "Chennai", destination: "", currency: "INR" })],
  { deskType: "warehouse", origin: "Chennai", destination: "", currency: "INR" },
  365,
  25,
  now,
);
assert.deepEqual(warehouseCandidates, ["wh-1"]);

function savedQuote(partial: Partial<SavedQuote> & { details: Record<string, unknown> }): SavedQuote {
  return {
    id: "q",
    customer: "Acme",
    creator: "u",
    status: "quoted",
    type: "quote",
    currency: "INR",
    timestamp: now,
    ...partial,
  };
}

// extractCourierCharges — Tier-1-only (same directoryCarrier), amounts only fill when consistent
const courierFilter: HistoricalMatchFilter = {
  deskType: "courier",
  origin: "Mumbai",
  destination: "Delhi",
  currency: "INR",
  scope: "domestic",
  carrierName: "DHL",
};
function courierQuote(): SavedQuote {
  return savedQuote({
    details: {
      originCity: "Mumbai",
      destCity: "Delhi",
      scope: "domestic",
      carrierQuotes: [
        {
          directoryCarrier: "DHL",
          manualSell: 1000,
          manualBuy: 800,
          surcharges: { fuelPct: 12, remoteAmount: 150 },
        },
      ],
    },
  });
}
const courierResult = extractCourierCharges([courierQuote(), courierQuote()], courierFilter);
assert.equal(courierResult.manualSell, 1000);
assert.equal(courierResult.manualBuy, 800);
assert.equal(courierResult.fuelPct, 12);
assert.equal(courierResult.remoteAmount, 150);
assert.equal(courierResult.residentialAmount, null); // never set — no samples

// extractCourierCharges — a different carrier's rate is never blended in
const courierMixed = extractCourierCharges(
  [courierQuote(), savedQuote({
    details: {
      originCity: "Mumbai",
      destCity: "Delhi",
      scope: "domestic",
      carrierQuotes: [{ directoryCarrier: "FedEx", manualSell: 1500, manualBuy: 1200, surcharges: {} }],
    },
  })],
  courierFilter,
);
assert.equal(courierMixed.manualSell, null); // only 1 DHL sample — below MIN_SAMPLES

// extractCourierCharges — a scope mismatch (domestic vs international) is excluded
const courierWrongScope = extractCourierCharges(
  [courierQuote(), savedQuote({
    details: {
      originCity: "Mumbai",
      destCity: "Delhi",
      scope: "international",
      carrierQuotes: [{ directoryCarrier: "DHL", manualSell: 1000, manualBuy: 800, surcharges: {} }],
    },
  })],
  courierFilter,
);
assert.equal(courierWrongScope.manualSell, null); // only 1 domestic sample

// extractTransportCharges — route lives on details.lanes[0], Tier-1-only by trucker name
const transportFilter: HistoricalMatchFilter = {
  deskType: "transport",
  origin: "Chennai",
  destination: "Bengaluru",
  currency: "INR",
  carrierName: "Sri Balaji Transport",
};
function transportQuote(freightSell: number): SavedQuote {
  return savedQuote({
    details: {
      lanes: [{ id: "lane_0", origin: "Chennai", destination: "Bengaluru" }],
      truckers: [
        { name: "Sri Balaji Transport", freightSell, freightBuy: freightSell - 500, detention: 200, tolls: 100 },
      ],
    },
  });
}
const transportResult = extractTransportCharges([transportQuote(5000), transportQuote(5000)], transportFilter);
assert.equal(transportResult.freightSell, 5000);
assert.equal(transportResult.freightBuy, 4500);
assert.equal(transportResult.detention, 200);
assert.equal(transportResult.tolls, 100);

// extractTransportCharges — a different lane is excluded
const transportWrongLane = extractTransportCharges(
  [transportQuote(5000), savedQuote({
    details: {
      lanes: [{ id: "lane_0", origin: "Mumbai", destination: "Pune" }],
      truckers: [{ name: "Sri Balaji Transport", freightSell: 5000, freightBuy: 4500, detention: 200, tolls: 100 }],
    },
  })],
  transportFilter,
);
assert.equal(transportWrongLane.freightSell, null); // only 1 Chennai->Bengaluru sample

// extractWarehouseCharges — matched purely by location, no carrier concept
const warehouseFilter: HistoricalMatchFilter = {
  deskType: "warehouse",
  origin: "Chennai",
  destination: "",
  currency: "INR",
};
function warehouseQuote(ratePerCbm: number): SavedQuote {
  return savedQuote({ details: { location: "Chennai", ratePerCbm, handling: 500, buyTotal: 4000 } });
}
const warehouseResult = extractWarehouseCharges(
  [warehouseQuote(120), warehouseQuote(120)],
  warehouseFilter,
);
assert.equal(warehouseResult.ratePerCbm, 120);
assert.equal(warehouseResult.handling, 500);
assert.equal(warehouseResult.buyTotal, 4000);

// extractWarehouseCharges — a different location is excluded
const warehouseWrongLocation = extractWarehouseCharges(
  [warehouseQuote(120), savedQuote({ details: { location: "Mumbai", ratePerCbm: 90, handling: 300, buyTotal: 2000 } })],
  warehouseFilter,
);
assert.equal(warehouseWrongLocation.ratePerCbm, null); // only 1 Chennai sample

console.log("historical-autofill.test.ts: all assertions passed");
