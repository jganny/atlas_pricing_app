import assert from "node:assert/strict";
import type { EnquiryRecord } from "@/lib/types";
import { agoLabel, placeCode, suggestCarriers } from "./carrier-suggestions";

const day = 86_400_000;
const now = Date.UTC(2026, 9, 30);
const enq = (over: Partial<EnquiryRecord>): EnquiryRecord => ({
  id: String(Math.random()), ref: "R", customer: "C", mode: "air", origin: "BLR", destination: "DXB", status: "quoted",
  slaHoursOpen: 0, assignee: "", creator: "", createdAt: new Date(now - 5 * day).toISOString(), carrier: "EK", ...over,
});

assert.equal(placeCode("BLR"), "BLR");
assert.equal(placeCode("BLR - Bangalore"), "BLR");
assert.equal(placeCode("Bangalore (BLR)"), "BLR");
assert.equal(placeCode("inmaa"), "INMAA");

const rows = [
  enq({ carrier: "EK" }), enq({ carrier: "ek", createdAt: new Date(now - 1 * day).toISOString() }), enq({ carrier: "EK" }),
  enq({ carrier: "QR" }), enq({ carrier: "QR" }),
  enq({ carrier: "EY" }),
  enq({ carrier: "SQ", destination: "SIN" }),                 // other lane
  enq({ carrier: "AI", mode: "sea" }),                        // other mode
  enq({ carrier: "LH", status: "cancelled" }),                // cancelled quotes do not count
  enq({ carrier: "", legs: [{ origin: "BLR", destination: "DXB", carrier: "QR", kind: "airline" }] }), // multi-lane legs
];
const out = suggestCarriers({ enquiries: rows, mode: "air", origin: "BLR - Bangalore", destination: "Dubai (DXB)", hasTariff: (n) => /ek|qr/i.test(n) });
assert.deepEqual(out.map((s) => s.name), ["EK", "QR", "EY"], "most used first, other lanes/modes/cancelled left out");
assert.deepEqual(out.map((s) => s.uses), [3, 3, 1]);
assert.equal(out[0].lastUsed, now - 1 * day, "most recent use is kept");
assert.equal(out[0].hasTariff, true);
assert.equal(out[2].hasTariff, false);
assert.deepEqual(suggestCarriers({ enquiries: rows, mode: "air", origin: "", destination: "DXB", hasTariff: () => false }), []);
assert.equal(agoLabel(now - 3 * day, now), "3 days ago");
assert.equal(agoLabel(now, now), "today");
assert.equal(agoLabel(now - 65 * day, now), "2 months ago");
console.log("carrier-suggestions tests passed");
