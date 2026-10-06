import assert from "node:assert/strict";
import {
  bestOption,
  containerCbm,
  containerOptions,
  containerSpec,
  loadTotals,
  nearestContainerCode,
  packCargo,
} from "./container-load";

const hc = containerSpec("40'HC");
assert.equal(Math.round(containerCbm(hc) * 10) / 10, 76.4);
assert.equal(nearestContainerCode("20'GP"), "20'GP");
assert.equal(nearestContainerCode("40'RF"), "40'GP");
assert.equal(nearestContainerCode("45'HC"), "40'HC");
assert.equal(nearestContainerCode(undefined), "40'HC");

// 100 cartons of 50 x 40 x 30 cm (60 L each), 20 kg each
const rows = [{ l: 50, w: 40, h: 30, qty: 100, gw: 20 }];
const totals = loadTotals(rows, "cms");
assert.equal(Math.round(totals.volumeCbm * 100) / 100, 6);
assert.equal(totals.weightKg, 2000);

const p = packCargo(rows, "cms", hc);
assert.equal(p.totalPieces, 100);
assert.equal(p.boxes.length, 100);
assert.equal(p.tooBig, false);
// 40HC: 2.352/0.4 = 5 across, 2.698/0.3 = 8 layers => 40 per slab => 3 slabs of 0.5 m
assert.equal(Math.round(p.lengthUsedM * 100) / 100, 1.5);
assert.ok(p.boxes.every((b) => b.x > 0 && b.x < hc.length && b.y > 0 && Math.abs(b.z) < hc.width / 2));

// everything fits in one container of any type
const opts = containerOptions(rows, "cms");
assert.deepEqual(opts.map((o) => o.count), [1, 1, 1]);
assert.equal(bestOption(opts)?.code, "20'GP"); // tie on count -> smaller capacity

// Too much cargo for a 20 -> needs more 20s, 1 x 40
const big = [{ l: 100, w: 100, h: 100, qty: 40, gw: 300 }]; // 40 cbm, 12 t (1 m cubes pack 2 x 2 across)
const bigOpts = containerOptions(big, "cms");
const byCode = Object.fromEntries(bigOpts.map((o) => [o.code, o]));
assert.ok((byCode["20'GP"].count as number) >= 2);
assert.equal(byCode["40'GP"].count, 1);
assert.equal(bestOption(bigOpts)?.count, 1);

// weight can force a second container even when it is physically roomy
const heavy = [{ l: 100, w: 100, h: 100, qty: 10, gw: 3000 }]; // 30 t
const heavyOpts = containerOptions(heavy, "cms");
assert.ok(heavyOpts.every((o) => (o.count as number) >= 2));

// a piece wider than the container can't be loaded
const wide = containerOptions([{ l: 100, w: 300, h: 100, qty: 1, gw: 10 }], "cms");
assert.ok(wide.every((o) => o.count === null));
assert.equal(bestOption(wide), null);

// inches
const inch = loadTotals([{ l: 39.37, w: 39.37, h: 39.37, qty: 1, gw: 1 }], "inches");
assert.equal(Math.round(inch.volumeCbm * 100) / 100, 1);

// drawing is capped but totals are not
const many = packCargo([{ l: 10, w: 10, h: 10, qty: 5000, gw: 1 }], "cms", hc);
assert.equal(many.totalPieces, 5000);
assert.equal(many.boxes.length, 1500);
assert.equal(many.drawingCapped, true);

console.log("container-load.test.ts: all assertions passed");
