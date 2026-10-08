import assert from "node:assert/strict";
import { daysSince, escalationTier, missingWonFields, splitWonRows, type WonFollowUpValues } from "./won-followups";

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

// A row's place on the list depends on what is SAVED. Typing into the last missing field must not
// make it vanish before Save (the reported "can't enter / can't save" bug).
const full: WonFollowUpValues = { shipperName: "S", consigneeName: "C", commodity: "Gen", buyRate: 5, sellAmount: 7 };
const row = (id: string, wonAt: string, over: Partial<WonFollowUpValues> = {}) => ({ id, wonAt, ...full, ...over });
const rows = [
  row("done", "2026-09-01T00:00:00Z"),
  row("newer", "2026-09-20T00:00:00Z", { shipperName: "" }),
  row("older", "2026-09-05T00:00:00Z", { buyRate: 0, sellAmount: 0 }),
];
const split = splitWonRows(rows);
assert.deepEqual(split.pending.map((r) => r.id), ["older", "newer"], "oldest waiting first");
assert.deepEqual(split.complete.map((r) => r.id), ["done"]);
// The user starts typing the one missing shipper name: the saved row is unchanged, so it stays listed.
const typedDraft = { ...rows[1], shipperName: "A" };
assert.equal(missingWonFields(typedDraft).length, 0, "the draft alone would look complete…");
assert.equal(splitWonRows(rows).pending.some((r) => r.id === "newer"), true, "…but the row is still on the list until saved");
// Once saved, it moves to complete.
assert.equal(splitWonRows([typedDraft]).complete.length, 1);

console.log("won-followups.test.ts: all assertions passed");
