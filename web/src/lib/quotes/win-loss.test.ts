import assert from "node:assert/strict";
import { summarizeWinLoss } from "./win-loss";
import type { EnquiryRecord } from "../types";

const now = Date.parse("2026-10-06T00:00:00Z");

function q(partial: Partial<EnquiryRecord>): EnquiryRecord {
  return {
    id: "x",
    ref: "R",
    customer: "Acme",
    mode: "air",
    origin: "BOM",
    destination: "LHR",
    status: "won",
    slaHoursOpen: 0,
    assignee: "",
    creator: "",
    createdAt: "2026-08-01T00:00:00Z",
    currency: "USD",
    appliedRate: 4,
    ...partial,
  };
}

const query = { mode: "air" as const, origin: "BOM", destination: "LHR", currency: "USD", currentRate: 4.34 };

// Too few decided quotes — panel stays quiet
const few = summarizeWinLoss([q({ id: "1" }), q({ id: "2", status: "lost", appliedRate: 4.8 })], query, now);
assert.equal(few.decided, 2);
assert.equal(few.enough, false);

// Mixed history: 4 won (3.95-4.20), 3 lost (4.50-5.20), 2 open, plus noise that must be ignored
const history: EnquiryRecord[] = [
  q({ id: "w1", appliedRate: 3.95 }),
  q({ id: "w2", appliedRate: 4.1 }),
  q({ id: "w3", appliedRate: 4.2 }),
  q({ id: "w4", appliedRate: 4.0 }),
  q({ id: "l1", status: "lost", appliedRate: 4.5 }),
  q({ id: "l2", status: "lost", appliedRate: 4.8 }),
  q({ id: "l3", status: "lost", appliedRate: 5.2 }),
  q({ id: "o1", status: "open", appliedRate: 4.3 }),
  q({ id: "o2", status: "quoted", appliedRate: 4.4 }),
  q({ id: "c1", status: "cancelled", appliedRate: 9 }), // cancelled never counts as decided
  q({ id: "otherLane", destination: "DXB", status: "lost" }),
  q({ id: "otherMode", mode: "sea", status: "lost" }),
  q({ id: "stale", status: "lost", createdAt: "2024-01-01T00:00:00Z" }),
  q({ id: "eur", status: "lost", currency: "EUR", appliedRate: 99 }), // counts toward win rate, not the USD band
];
const s = summarizeWinLoss(history, query, now);
assert.equal(s.won, 4);
assert.equal(s.lost, 4); // l1-l3 + the EUR loss
assert.equal(s.open, 2);
assert.equal(s.winRatePct, 50);
assert.equal(s.enough, true);
assert.deepEqual([s.wonBand?.min, s.wonBand?.max], [3.95, 4.2]);
assert.deepEqual([s.lostBand?.min, s.lostBand?.max], [4.5, 5.2]); // EUR 99 excluded
assert.equal(s.position, "between"); // 4.34 sits between 4.20 and 4.50
assert.deepEqual(s.aboveWonCeiling, { rate: 4.2, lost: 3, total: 3 });
assert.equal(s.recent.length, 3);

// Position at the edges
assert.equal(summarizeWinLoss(history, { ...query, currentRate: 4.1 }, now).position, "in-wins");
assert.equal(summarizeWinLoss(history, { ...query, currentRate: 4.6 }, now).position, "in-losses");
assert.equal(summarizeWinLoss(history, { ...query, currentRate: null }, now).position, "unknown");

// Full labels and bare codes are the same lane
const labelled = summarizeWinLoss(
  history,
  { ...query, origin: "BOM - Chhatrapati Shivaji Intl, Mumbai", destination: "LHR - London Heathrow" },
  now,
);
assert.equal(labelled.won, 4);

// Sea: only quotes priced by revenue ton have a unit rate
const sea = summarizeWinLoss(
  [
    q({ id: "s1", mode: "sea", appliedRate: undefined, billingUnit: "rt", billingWeight: 10, grandTotal: 500 }),
    q({ id: "s2", mode: "sea", appliedRate: undefined, billingUnit: "rt", billingWeight: 10, grandTotal: 520 }),
    q({ id: "s3", mode: "sea", status: "lost", appliedRate: undefined, billingUnit: "rt", billingWeight: 10, grandTotal: 700 }),
    q({ id: "s4", mode: "sea", status: "lost", appliedRate: undefined }), // FCL, no unit rate
  ],
  { mode: "sea", origin: "BOM", destination: "LHR", currency: "USD", currentRate: 55 },
  now,
);
assert.equal(sea.decided, 4);
assert.deepEqual([sea.wonBand?.min, sea.wonBand?.max], [50, 52]);
assert.equal(sea.lostBand?.min, 70);
assert.equal(sea.position, "between");

console.log("win-loss.test.ts: all assertions passed");
