import assert from "node:assert/strict";
import { rankCarrierHits, type CarrierRecord } from "./directory";

const rows: CarrierRecord[] = [
  { code: "1L", name: "Open Skies Consultative Commission", kind: "airline" },
  { code: "EK", name: "Emirates SkyCargo", kind: "airline" },
  { code: "UL", name: "SriLankan Airlines", kind: "airline", country: "Sri Lanka" },
  { code: "UA", name: "United Cargo", kind: "airline" },
  { code: "G9", name: "Air Arabia", kind: "airline" },
];

const ul = rankCarrierHits("ul", rows, 10);
assert.equal(ul[0]?.code, "UL");
assert.equal(ul[0]?.name, "SriLankan Airlines");
assert.ok(!ul.some((c) => c.code === "1L"), "junk GDS 1L must not outrank UL");

const sri = rankCarrierHits("sri", rows, 10);
assert.equal(sri[0]?.code, "UL");

const lankan = rankCarrierHits("srilankan", rows, 10);
assert.equal(lankan[0]?.code, "UL");

const ek = rankCarrierHits("ek", rows, 10);
assert.equal(ek[0]?.code, "EK");

console.log("carrier rank tests passed");
