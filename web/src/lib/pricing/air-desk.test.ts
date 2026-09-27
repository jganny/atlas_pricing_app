import assert from "node:assert/strict";
import type { WeightBreaks } from "@atlas/pricing-core";
import { computeAdjacentBreakComparison, EMPTY_AIR_BREAKS } from "./air-desk";

// The exact scenario the desk raised: 90kg falls inside the +45kg bracket,
// but the +100kg bracket's rate can price lower once you pay for its
// 100kg minimum instead of the literal 90kg.
const breaks: WeightBreaks = {
  ...EMPTY_AIR_BREAKS,
  plus45: { sell: 4.85, buy: 4.2 },
  plus100: { sell: 4.15, buy: 3.6 },
};

const cmp = computeAdjacentBreakComparison(90, breaks);
assert.ok(cmp, "expected a comparison for 90kg with both brackets priced");
assert.equal(cmp!.current.breakName, "plus45");
assert.equal(cmp!.next.breakName, "plus100");
assert.equal(cmp!.current.weightUsedKg, 90);
assert.equal(cmp!.next.weightUsedKg, 100, "next bracket must round up to its own minimum, not the literal weight");
assert.equal(Math.round(cmp!.current.total * 100) / 100, 436.5);
assert.equal(Math.round(cmp!.next.total * 100) / 100, 415);
assert.equal(cmp!.cheaper, "next");

// No comparison when the next bracket has no rate entered — never guess.
const onlyCurrent: WeightBreaks = { ...EMPTY_AIR_BREAKS, plus45: { sell: 5, buy: 4 } };
assert.equal(computeAdjacentBreakComparison(90, onlyCurrent), null);

// No comparison at zero/blank weight.
assert.equal(computeAdjacentBreakComparison(0, breaks), null);

// Top bracket (plus1000) has no "next" tier to compare against.
const topOnly: WeightBreaks = { ...EMPTY_AIR_BREAKS, plus1000: { sell: 3, buy: 2 } };
assert.equal(computeAdjacentBreakComparison(1200, topOnly), null);

console.log("air-desk.test.ts: all assertions passed");
