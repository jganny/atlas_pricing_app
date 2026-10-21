import assert from "node:assert/strict";
import { laneChips, shortCode, type CarrierCodeRow } from "./lane-carriers";
import type { AirTariff, DirectoryContact, SeaTariff } from "@/lib/types";

const codes: CarrierCodeRow[] = [{ code: "EK", name: "Emirates" }, { code: "QR", name: "Qatar Airways" }, { code: "MSCU", name: "MSC" }];
const air = (o: Partial<AirTariff>): AirTariff => ({ id: "1", carrier: "Emirates", carrierCode: "EK", origin: "BLR", destination: "BEY", currency: "USD", breaks: { plus100: { sell: 3, buy: 2 } }, createdAt: "2026-10-01", ...o });
const c = (o: Partial<DirectoryContact>): DirectoryContact => ({ id: "c", name: "X", category: "airline", sheetGroup: "Airlines", ...o });

// Short codes
assert.equal(shortCode("Emirates SkyCargo", "ek", codes), "EK", "the tariff's own code wins");
assert.equal(shortCode("Qatar Airways", undefined, codes), "QR", "found in the carriers list");
assert.equal(shortCode("Middle East Express", undefined, []), "ME", "otherwise its initials");
assert.equal(shortCode("Gulf", "", []), "GU");

const base = { mode: "air" as const, originCode: "BLR", destCode: "BEY", originCountry: "IN", destCountry: "LB", seaMode: "fcl", airTariffs: [], seaTariffs: [], contacts: [], codes };

// Green: rate on file on this lane only; no rate, no chip
let chips = laneChips({ ...base, airTariffs: [air({}), air({ id: "2", carrier: "Qatar Airways", carrierCode: "QR" }), air({ id: "3", destination: "DXB" }), air({ id: "4", carrier: "Empty", carrierCode: "XX", breaks: {} })] });
assert.deepEqual(chips.map((x) => `${x.code}:${x.status}`), ["EK:rate", "QR:rate"]);

// Red: Directory vendors that serve the foreign end but have no rate on file; a vendor with a rate is shown once, green
chips = laneChips({
  ...base,
  airTariffs: [air({})],
  contacts: [
    c({ id: "1", name: "Emirates", coverage: ["LB"] }),
    c({ id: "2", name: "Middle East Express", sheetGroup: "Co-loaders", coverage: ["LB", "AE"] }),
    c({ id: "3", name: "Gulf Air Cargo", location: "Beirut, Lebanon" }),
    c({ id: "4", name: "Qatar Cargo", coverage: ["QA"] }), // serves somewhere else
    c({ id: "5", name: "Suspended Air", coverage: ["LB"], suspended: true }),
    c({ id: "6", name: "Some Agent", category: "agency", location: "Beirut, Lebanon" }),
    c({ id: "7", name: "Big Liner", sheetGroup: "Shipping Lines", coverage: ["LB"] }), // sea vendor on an air lane
  ],
});
assert.deepEqual(chips.map((x) => `${x.code}:${x.status}`), ["EK:rate", "GA:none", "ME:none"]);

// Imports: the foreign end is the origin
chips = laneChips({ ...base, originCode: "BEY", destCode: "BLR", originCountry: "LB", destCountry: "IN", airTariffs: [air({ origin: "BEY", destination: "BLR" })], contacts: [c({ name: "Gulf Air Cargo", coverage: ["LB"] })] });
assert.deepEqual(chips.map((x) => x.code), ["EK", "GA"]);

// Sea lanes use sea tariffs and the chosen FCL/LCL mode
const sea: SeaTariff = { id: "s", carrier: "MSC", carrierCode: "MSCU", origin: "INMAA", destination: "AEJEA", mode: "fcl", currency: "USD", lclRate: { sell: 0, buy: 0 }, fclRates: { "20'GP": { sell: 900, buy: 800 } }, createdAt: "2026-10-01" };
assert.deepEqual(laneChips({ ...base, mode: "sea", originCode: "INMAA", destCode: "AEJEA", seaTariffs: [sea] }).map((x) => x.code), ["MSCU"]);
assert.equal(laneChips({ ...base, mode: "sea", originCode: "INMAA", destCode: "AEJEA", seaMode: "lcl", seaTariffs: [sea] }).length, 0, "an FCL-only tariff is not shown on an LCL quote");
assert.equal(laneChips({ ...base, originCode: "", airTariffs: [air({})] }).length, 0, "nothing until the lane is chosen");
console.log("lane-carriers tests passed");
