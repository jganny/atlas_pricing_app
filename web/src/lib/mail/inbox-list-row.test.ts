import assert from "node:assert/strict";
import { inboxListPreview, inboxListWhen } from "./inbox-list-row";

const noon = Date.parse("2026-11-11T12:00:00+05:30");

assert.equal(inboxListWhen("2026-11-11T16:41:00+05:30", noon), "16:41");
assert.equal(inboxListWhen("2026-11-10T19:10:00+05:30", noon), "10 Nov");
assert.equal(inboxListWhen("", noon), "");

assert.equal(
  inboxListPreview({
    mode: "air",
    parsed: { origin: "AMD", destination: "LRD" },
    bodyPreview: "Please quote air today. Packing list attached.",
  }),
  "AMD → LRD · Air · Please quote air today. Packing list attached.",
);

assert.equal(
  inboxListPreview({ mode: "sea", bodyPreview: "  two 40HC  " }),
  "Sea · two 40HC",
);

assert.equal(
  inboxListPreview({
    from: "Atlaslogistics <pricing@atlaslogistics.co.in>",
    subject: "Air Freight // BLR to Qatar // 560 Kgs",
    bodyPreview: "Dear Awwab Pls find below quote for said shipment",
  }),
  "Internal quote · for Awwab · Dear Awwab Pls find below quote for said shipment",
);

console.log("inbox-list-row tests passed");
