import assert from "node:assert/strict";
import {
  normalizeSurchargeName,
  pickConsistentValue,
  selectCandidateIds,
  withinLookbackDays,
  type HistoricalMatchFilter,
} from "./historical-autofill";
import type { EnquiryRecord } from "../types";

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

console.log("historical-autofill.test.ts: all assertions passed");
