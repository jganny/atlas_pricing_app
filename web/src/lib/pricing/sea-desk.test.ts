import assert from "node:assert/strict";
import { seaCargoHasData, summarizeSeaCargo, type SeaCargoRow } from "./sea-desk";

// cm: 2 pieces of 100x80x60cm at 150kg each.
// Volume = (100*80*60*2) / 1,000,000 = 0.96 CBM. Weight = 150*2 = 300kg.
const cmRows: SeaCargoRow[] = [{ l: 100, w: 80, h: 60, qty: 2, gw: 150 }];
const cmSummary = summarizeSeaCargo(cmRows, "cms");
assert.equal(cmSummary.grossWeightKg, 300);
assert.equal(Math.round(cmSummary.volumeCbm * 1000) / 1000, 0.96);

// Same physical box in inches (100cm ≈ 39.3701in, 80cm ≈ 31.4961in, 60cm ≈
// 23.6220in) should land on very close to the same CBM once converted —
// confirms the in³→m³ divisor is correct, not just internally consistent.
const inRows: SeaCargoRow[] = [{ l: 39.3701, w: 31.4961, h: 23.622, qty: 2, gw: 150 }];
const inSummary = summarizeSeaCargo(inRows, "inches");
assert.ok(
  Math.abs(inSummary.volumeCbm - cmSummary.volumeCbm) < 0.001,
  `inches conversion should match the cm equivalent: got ${inSummary.volumeCbm}, expected ~${cmSummary.volumeCbm}`,
);

// Multiple rows sum.
const multiRows: SeaCargoRow[] = [
  { l: 50, w: 50, h: 50, qty: 1, gw: 20 },
  { l: 100, w: 100, h: 100, qty: 1, gw: 80 },
];
const multiSummary = summarizeSeaCargo(multiRows, "cms");
assert.equal(multiSummary.grossWeightKg, 100);
assert.equal(Math.round(multiSummary.volumeCbm * 1000) / 1000, 1.125); // 0.125 + 1.0

// Empty/zero rows.
assert.deepEqual(summarizeSeaCargo([], "cms"), { grossWeightKg: 0, volumeCbm: 0 });
assert.deepEqual(
  summarizeSeaCargo([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }], "cms"),
  { grossWeightKg: 0, volumeCbm: 0 },
);

// seaCargoHasData — the switch between "manual flat fields" and "computed
// from rows" mode.
assert.equal(seaCargoHasData([]), false);
assert.equal(seaCargoHasData([{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }]), false, "an all-zero row is not real data");
assert.equal(seaCargoHasData([{ l: 10, w: 0, h: 0, qty: 1, gw: 0 }]), true, "any one dimension counts");
assert.equal(seaCargoHasData([{ l: 0, w: 0, h: 0, qty: 1, gw: 50 }]), true, "weight alone counts");

console.log("sea-desk.test.ts: all assertions passed");
