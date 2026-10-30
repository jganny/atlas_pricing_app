import assert from "node:assert/strict";
import type { WeightBreaks } from "@atlas/pricing-core";
import { computeAdjacentBreakComparison, computeAirlineTotals, EMPTY_AIR_BREAKS, visibleAirBreaks } from "./air-desk";
import { createAirlineOption } from "./carrier-options";
import { createSurchargeRow } from "./surcharges";

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

// Local Origin Charges / Destination Clearance Charges — quote-wide, folded
// into every carrier's total, never touching the carrier's own surcharges.
const cargo = [{ l: 0, w: 0, h: 0, qty: 1, gw: 100 }];
const option = createAirlineOption(
  {
    wbEnabled: true,
    breaks: { ...EMPTY_AIR_BREAKS, plus100: { sell: 4, buy: 3 } },
    originSurcharges: [createSurchargeRow({ name: "Fuel Surcharge", sell: 50, buy: 40, unit: "flat" })],
    destSurcharges: [],
  },
  true,
);
const withoutShared = computeAirlineTotals(cargo, option);
assert.equal(withoutShared.localOriginTotal, 0, "no shared charges passed — nothing added");

const local = [createSurchargeRow({ name: "Customs Clearance", sell: 65, buy: 50, unit: "flat" })];
const destClearance = [createSurchargeRow({ name: "Delivery", sell: 60, buy: 45, unit: "flat" })];
const withShared = computeAirlineTotals(cargo, option, "cms", local, destClearance);
assert.equal(withShared.localOriginTotal, 65);
assert.equal(withShared.destClearanceTotal, 60);
assert.equal(
  Math.round((withShared.grandSell - withoutShared.grandSell) * 100) / 100,
  125,
  "shared charges must add exactly their own sell total on top, nothing else changes",
);
assert.equal(
  withShared.origin[0]?.calculatedCost,
  withoutShared.origin[0]?.calculatedCost,
  "the carrier's own Fuel Surcharge must be untouched by the shared charges",
);

// An amended quote must not look as if its freight went missing: a break that already holds a rate stays visible
// next to the active one, even when it is not the break the current weight falls in.
const savedRates: WeightBreaks = { ...EMPTY_AIR_BREAKS, plus300: { sell: 4.9, buy: 4.1 } };
assert.deepEqual(visibleAirBreaks(150, "plus100", false), ["plus100"], "no saved rate elsewhere: only the active break");
assert.deepEqual(visibleAirBreaks(150, "plus100", false, savedRates), ["plus100", "plus300"], "a saved rate on another break stays in view");
assert.deepEqual(visibleAirBreaks(150, "plus300", false, savedRates), ["plus300"], "the active break is never listed twice");
assert.equal(visibleAirBreaks(150, "plus100", true, savedRates).length, 7, "show-all still shows every break");

console.log("air-desk.test.ts: all assertions passed");
