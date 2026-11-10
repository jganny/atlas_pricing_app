import assert from "node:assert/strict";
import { createSurchargeRow } from "./surcharges";
import { airExwApplies, airExwFillDecision, airHandlingAmount, buildAirExwRows, isAirExwRow } from "./exw-air-charges";

// Handling / C.Clr: higher of 0.15/kg and 75 below 500 kg; then one rate for the whole shipment by its band.
assert.equal(airHandlingAmount(0), 0);
assert.equal(airHandlingAmount(100), 75, "100 kg: 15 is below the minimum, so 75");
assert.equal(airHandlingAmount(500 - 0.01) > 74.9, true);
assert.equal(airHandlingAmount(499), 75, "499 kg: 74.85 is below the minimum, so 75");
assert.equal(airHandlingAmount(400), 75);
assert.equal(airHandlingAmount(600), 60, "600 kg x 0.10");
assert.equal(airHandlingAmount(500), 50, "from 500 kg the 0.10 band applies");
assert.equal(airHandlingAmount(999), 99.9);
assert.equal(airHandlingAmount(1000), 70, "from 1000 kg the 0.07 band applies");
assert.equal(airHandlingAmount(1500), 105);

assert.equal(airExwApplies("EXW", "USD"), "EXW");
assert.equal(airExwApplies("fca", "gbp"), "FCA");
assert.equal(airExwApplies("EXW", "EUR"), "EXW");
assert.equal(airExwApplies("EXW", "INR"), null, "other currencies are not filled");
assert.equal(airExwApplies("FOB", "USD"), null);

const exw = buildAirExwRows("EXW", 142);
assert.deepEqual(exw.map((r) => r.name), ["Pickup", "Handling / C.Clr", "Fumigation"]);
assert.equal(exw[0].buy, 0);
assert.equal(exw[1].buy, 75);
assert.equal(exw[2].buy, 35);
assert.ok(exw.every((r) => r.sell === 0 && r.unit === "flat" && isAirExwRow(r)));
const fca = buildAirExwRows("FCA", 600);
assert.deepEqual(fca.map((r) => r.name), ["Handling / C.Clr", "Fumigation"], "FCA has no pickup");
assert.equal(fca[0].buy, 60);

// Fill decisions: fill when untouched, never overwrite what the desk typed or edited.
assert.equal(airExwFillDecision({ current: [], previous: null, next: exw }), "fill");
assert.equal(airExwFillDecision({ current: exw, previous: exw, next: buildAirExwRows("EXW", 600) }), "fill", "weight changed, rows untouched: refill");
const edited = exw.map((r, i) => (i === 1 ? { ...r, buy: 99 } : r));
assert.equal(airExwFillDecision({ current: edited, previous: exw, next: buildAirExwRows("EXW", 600) }), "keep", "the desk edited a charge");
const typed = [...exw, createSurchargeRow({ name: "Xray", buy: 10 })];
assert.equal(airExwFillDecision({ current: typed, previous: exw, next: exw }), "keep", "the desk added a charge");
assert.equal(airExwFillDecision({ current: [], previous: exw, next: exw }), "keep", "the desk deleted everything after a fill");
assert.equal(airExwFillDecision({ current: exw, previous: exw, next: null }), "clear", "no longer EXW or FCA, untouched: take back");
assert.equal(airExwFillDecision({ current: edited, previous: exw, next: null }), "keep");

console.log("exw-air-charges tests passed");
