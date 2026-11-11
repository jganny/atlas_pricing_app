import assert from "node:assert/strict";
import { labelsOf } from "./inbox-labels";

const base = { subject: "", bodyPreview: "", body: "", receivedAt: "2026-11-11T08:35:00.000Z", from: "a@b.com" };

assert.deepEqual(labelsOf({ ...base, subject: "DGR shipment BLR to FRA", bodyPreview: "UN3481 lithium batteries, class 9" }), ["dg"]);
assert.deepEqual(labelsOf({ ...base, subject: "Pharma API 2-8 C cold chain BOM to DXB" }), ["pharma"]);
assert.ok(labelsOf({ ...base, subject: "Perishable fresh flowers to Dubai" }).includes("perishable"));
assert.ok(labelsOf({ ...base, subject: "Quote by 3 pm IST please" }).includes("deadline"));
assert.ok(labelsOf({ ...base, subject: "Rates please", bodyPreview: "See attached.", attachmentCount: 2 }).includes("attachment"), "almost no words, files attached");
assert.ok(!labelsOf({ ...base, subject: "Rates please", bodyPreview: "Dear team please quote for 3 pallets of garments from Mumbai to Hamburg with dimensions below and pickup in Pune next week thanks", attachmentCount: 1 }).includes("attachment"), "a full description is not attachment-only");
assert.deepEqual(labelsOf({ ...base, subject: "Rates BOM to LHR 100 kg general cargo" }), []);
assert.ok(!labelsOf({ ...base, subject: "Class action update" }).includes("dg"));
assert.deepEqual(labelsOf({ ...base, subject: "Pharma DGR lithium shipment by 3 pm IST", bodyPreview: "", attachmentCount: 1 }), ["dg", "pharma", "deadline", "attachment"]);

console.log("inbox-labels tests passed");
