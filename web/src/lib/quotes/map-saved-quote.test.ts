import assert from "node:assert/strict";
import { mapQuoteFromSaved, mapStatus, mergeEnquiryRows } from "./map-saved-quote";
import type { SavedQuote } from "../types";

assert.equal(mapStatus("converted"), "won");
assert.equal(mapStatus("won"), "won");
assert.equal(mapStatus("WON"), "won");
assert.equal(mapStatus("quoted"), "quoted");
assert.equal(mapStatus("lost"), "lost");
assert.equal(mapStatus("cancelled"), "cancelled");
assert.equal(mapStatus("canceled"), "cancelled");

const converted = mapQuoteFromSaved("q1", {
  id: "q1",
  customer: "Acme",
  creator: "ganny",
  status: "converted",
  type: "air",
  date: "2026-09-01",
  timestamp: 1_725_000_000_000,
  amount: 820,
  currency: "USD",
  amountINR: 68470,
  grossProfit: 40,
  route: "BLR → GRU",
  details: { origin: "BLR", destination: "GRU", airline: "QR" },
} as SavedQuote);

assert.equal(converted.status, "won");
assert.equal(converted.grandTotal, 820);
assert.equal(converted.origin, "BLR");

const quoted = mapQuoteFromSaved("q2", {
  id: "q2",
  customer: "Beta",
  creator: "ganny",
  status: "quoted",
  type: "air",
  date: "2026-09-02",
  amount: 100,
} as SavedQuote);
assert.equal(quoted.status, "quoted");

const merged = mergeEnquiryRows([quoted], [converted]);
assert.equal(merged.length, 2);
assert.ok(merged.some((r) => r.status === "won"));

console.log("map-saved-quote tests passed");
