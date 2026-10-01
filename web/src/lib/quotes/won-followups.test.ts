import assert from "node:assert/strict";
import { daysSince, escalationTier, missingWonFields, type WonFollowUpValues } from "./won-followups";

const complete: WonFollowUpValues = {
  shipperName: "Acme Exports",
  consigneeName: "Acme Imports",
  commodity: "GENERAL",
  buyRate: 100,
  sellAmount: 150,
};

assert.deepEqual(missingWonFields(complete), [], "nothing missing when every field is filled");
assert.deepEqual(
  missingWonFields({ ...complete, shipperName: "  ", buyRate: 0 }),
  ["shipperName", "buyRate"],
  "blank/whitespace text and a zero rate both count as missing",
);
assert.deepEqual(
  missingWonFields({ ...complete, sellAmount: -5 }),
  ["sellAmount"],
  "a negative amount counts as missing, not just zero",
);

const now = new Date("2026-09-30T12:00:00Z");
assert.equal(daysSince("2026-09-30T08:00:00Z", now), 0);
assert.equal(daysSince("2026-09-28T12:00:00Z", now), 2);
assert.equal(daysSince("2026-09-21T12:00:00Z", now), 9);

assert.equal(escalationTier("2026-09-30T08:00:00Z", now), "quiet", "day 0");
assert.equal(escalationTier("2026-09-28T12:00:00Z", now), "quiet", "day 2 is still quiet");
assert.equal(escalationTier("2026-09-27T12:00:00Z", now), "amber", "day 3 tips into amber");
assert.equal(escalationTier("2026-09-23T12:00:00Z", now), "amber", "day 7 is still amber");
assert.equal(escalationTier("2026-09-22T12:00:00Z", now), "red", "day 8 tips into red");
assert.equal(escalationTier("2026-09-01T12:00:00Z", now), "red", "long overdue stays red");

console.log("won-followups.test.ts: all assertions passed");
