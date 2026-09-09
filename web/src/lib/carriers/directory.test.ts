import assert from "node:assert/strict";
import {
  airlineDirectoryCount,
  rankCarrierHits,
  resolveCarrierLabel,
  searchCarriers,
  type CarrierRecord,
} from "./directory";

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

assert.equal(resolveCarrierLabel("ul"), "UL — SriLankan Airlines");
assert.equal(resolveCarrierLabel("UL"), "UL — SriLankan Airlines");
assert.equal(resolveCarrierLabel("sri lankan"), "UL — SriLankan Airlines");
assert.ok(
  resolveCarrierLabel("1L AIRLINE").includes("SriLankan") ||
    resolveCarrierLabel("1L AIRLINE") === "1L AIRLINE",
);

assert.ok(airlineDirectoryCount() > 800, "bundled OpenFlights dump must cover global IATA airlines");

async function checkBundled() {
  const bundled = await searchCarriers("ul", "airline", 8);
  assert.equal(bundled[0]?.code, "UL");
  assert.equal(bundled[0]?.name, "SriLankan Airlines");

  const courierDesk = await searchCarriers("ul", "airline+courier", 8);
  assert.equal(courierDesk[0]?.code, "UL");
  assert.ok(!courierDesk.some((c) => c.kind === "ocean"));

  const blue = await searchCarriers("BLUE DART", "airline+courier", 12);
  assert.equal(blue[0]?.code, "BLUEDART");
  assert.equal(blue[0]?.name, "Blue Dart");

  const dart = await searchCarriers("bluedart", "airline+courier", 8);
  assert.ok(dart.some((c) => c.code === "BLUEDART"));
}

void checkBundled()
  .then(() => {
    console.log("carrier rank tests passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
