import assert from "node:assert/strict";
import { calcSurchargeCost } from "./surcharges";
import { createSurchargeRow } from "./surcharges";
import { EXW_SHEETS, buildExwRows, exwFillDecision, sameExwRows, countBySize, exwSheetsForOrigin, exwValidity, isExwRow, sheetTotal, sizeBucket } from "./exw-sea-charges";

// Every total the agents printed must match what was copied (and "will revert" lines are simply not in the sum)
for (const s of EXW_SHEETS) {
  if (s.printedTotal?.per20 !== undefined) assert.equal(sheetTotal(s, 20), s.printedTotal.per20, `${s.id} 20' total`);
  if (s.printedTotal?.per40 !== undefined) assert.equal(sheetTotal(s, 40), s.printedTotal.per40, `${s.id} 40' total`);
}
assert.equal(EXW_SHEETS.length, 13);
assert.equal(new Set(EXW_SHEETS.map((s) => s.id)).size, 13);

// Origin port to sheets
assert.deepEqual(exwSheetsForOrigin("INNSA - Nhava Sheva").map((s) => s.id), ["mumbai-factory", "mumbai-cfs"]);
assert.deepEqual(exwSheetsForOrigin("INMAA").map((s) => s.id), ["chennai-factory", "chennai-cfs"]);
assert.deepEqual(exwSheetsForOrigin("INBLR - Bangalore ICD").map((s) => s.id), ["blr-factory-maa", "blr-factory-nhv", "blr-cfs"]);
assert.deepEqual(exwSheetsForOrigin("INMUN").map((s) => s.id), ["mundra-factory", "mundra-cfs"]);
assert.equal(exwSheetsForOrigin("INTKD").length, 2);
assert.equal(exwSheetsForOrigin("INHYD").length, 2);
assert.equal(exwSheetsForOrigin("NLRTM").length, 0, "a port the agents did not quote gets nothing");
assert.equal(exwSheetsForOrigin("").length, 0);

// Container sizes
assert.equal(sizeBucket("20'GP"), 20);
assert.equal(sizeBucket("40'HC"), 40);
assert.equal(sizeBucket("45'HC"), null);
assert.deepEqual(countBySize([{ type: "20'GP", qty: 2 }, { type: "40'HC", qty: 1 }, { type: "45'HC", qty: 1 }]), { n20: 2, n40: 1, other: 1 });

// One size: priced per container, so the quote shows the working and follows the container count
const chennai = EXW_SHEETS.find((s) => s.id === "chennai-factory")!;
const rows40 = buildExwRows(chennai, [{ type: "40'HC", qty: 2 }]);
assert.ok(rows40.every(isExwRow));
const thc = rows40.find((r) => r.name.startsWith("THC"))!;
assert.equal(thc.unit, "container");
assert.equal(thc.sell, 235);
assert.equal(calcSurchargeCost(thc, { containerCount: 2 }).calculatedCost, 470);
const transport40 = rows40.find((r) => r.name.startsWith("Transportation"))!;
assert.equal(transport40.sell, 250);
const rows20 = buildExwRows(chennai, [{ type: "20'GP", qty: 1 }]);
const transport20 = rows20.find((r) => r.name.startsWith("Transportation"))!;
assert.equal(transport20.sell, 0, "no amount on the sheet: kept as a line");
assert.equal(transport20.remarks, "Will revert");
const total20 = rows20.reduce((n, r) => n + calcSurchargeCost(r, { containerCount: 1 }).calculatedCost, 0);
assert.equal(total20, 390, "the filled charges add up to the sheet's own total");

// Both sizes: flat rows with the working in the name
const mixed = buildExwRows(chennai, [{ type: "20'GP", qty: 1 }, { type: "40'HC", qty: 2 }]);
const mixedThc = mixed.find((r) => r.name.startsWith("THC"))!;
assert.equal(mixedThc.unit, "flat");
assert.equal(mixedThc.name, "THC (1 × 20' + 2 × 40')");
assert.equal(mixedThc.sell, 95 + 2 * 235);
const mixedTransport = mixed.find((r) => r.name.startsWith("Transportation"))!;
assert.equal(mixedTransport.sell, 500, "the known 40' part is counted");
assert.match(mixedTransport.remarks, /Will revert/, "and the unknown 20' part is flagged");

// A 45' box has no rate on the sheets: flat rows, the 45' is left out of the arithmetic
const with45 = buildExwRows(chennai, [{ type: "40'HC", qty: 1 }, { type: "45'HC", qty: 1 }]);
assert.equal(with45.find((r) => r.name.startsWith("THC"))!.unit, "flat");

// A line with no amount in either size keeps its note
const hyd = EXW_SHEETS.find((s) => s.id === "hyd-factory")!;
const hydRows = buildExwRows(hyd, [{ type: "40'GP", qty: 1 }]);
const hydTransport = hydRows.find((r) => r.name.startsWith("Transportation"))!;
assert.equal(hydTransport.sell, 0);
assert.equal(hydTransport.remarks, "Need complete address");

// Validity
const today = new Date(2026, 9, 30);
assert.equal(exwValidity(EXW_SHEETS.find((s) => s.id === "mumbai-factory")!, today).state, "valid");
assert.equal(exwValidity(EXW_SHEETS.find((s) => s.id === "chennai-cfs")!, today).state, "expired");
assert.equal(exwValidity(EXW_SHEETS.find((s) => s.id === "mundra-factory")!, today).state, "undated");
// Customising the filled charges: the desk's changes are never overwritten
const c1 = [{ type: "40'HC", qty: 1 }];
const filled = buildExwRows(chennai, c1);
const refilledFor2 = buildExwRows(chennai, [{ type: "40'HC", qty: 2 }]);
assert.equal(sameExwRows(filled, buildExwRows(chennai, c1)), true);
assert.equal(exwFillDecision({ current: [], previous: null, next: filled }), "fill", "nothing there yet: fill");
assert.equal(exwFillDecision({ current: filled, previous: filled, next: refilledFor2 }), "fill", "untouched: refill for the new inputs");

const edited = filled.map((r) => (r.name.startsWith("THC") ? { ...r, sell: 300 } : r));
assert.equal(exwFillDecision({ current: edited, previous: filled, next: refilledFor2 }), "keep", "an edited amount is kept");
const renamed = filled.map((r, i) => (i === 0 ? { ...r, name: "Handling (special)" } : r));
assert.equal(exwFillDecision({ current: renamed, previous: filled, next: refilledFor2 }), "keep", "a renamed line is kept");
const noted = filled.map((r, i) => (i === 0 ? { ...r, remarks: "per agent email" } : r));
assert.equal(exwFillDecision({ current: noted, previous: filled, next: refilledFor2 }), "keep", "an added remark is kept");
assert.equal(exwFillDecision({ current: filled.slice(1), previous: filled, next: refilledFor2 }), "keep", "a deleted line stays deleted");
assert.equal(exwFillDecision({ current: [...filled, createSurchargeRow({ name: "Extra", sell: 10 })], previous: filled, next: refilledFor2 }), "keep", "an added line is kept");
assert.equal(exwFillDecision({ current: [], previous: filled, next: refilledFor2 }), "keep", "deleting everything after a fill is respected");
assert.equal(exwFillDecision({ current: filled, previous: null, next: refilledFor2 }), "keep", "a quote opened from a save is left exactly as saved");
assert.equal(exwFillDecision({ current: [createSurchargeRow({ name: "My THC", sell: 250 })], previous: null, next: filled }), "keep", "the desk's own typed charges are not overwritten");

// No longer an EXW export: untouched charges are taken back, changed ones are left
assert.equal(exwFillDecision({ current: filled, previous: filled, next: null }), "clear");
assert.equal(exwFillDecision({ current: edited, previous: filled, next: null }), "keep");
assert.equal(exwFillDecision({ current: [], previous: null, next: null }), "keep");
console.log("exw-sea-charges tests passed");
