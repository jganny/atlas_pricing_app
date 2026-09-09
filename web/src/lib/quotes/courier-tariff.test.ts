import assert from "node:assert/strict";
import {
  inferCourierCarrier,
  lookupCourierTariff,
  parseCourierTariffSheets,
  pickTariffSlab,
  COURIER_TARIFF_MAX_KG,
  type CourierTariffBook,
} from "./courier-tariff";

const exportSheet = {
  name: "Export 2026",
  rows: [
    ["Weight (kg)", "USA", "United Kingdom", "UAE", "Singapore"],
    [0.5, 2450, 1980, 1650, 1420],
    [1, 2800, 2200, 1800, 1600],
    [5, 6200, 5100, 4300, 3900],
    [70, 41000, 35500, 29800, 27100],
    [100, 99999, 99999, 99999, 99999],
  ],
};

const importSheet = {
  name: "Import",
  rows: [
    ["Kg", "USA", "Germany"],
    [0.5, 3100, 2700],
    [1, 3600, 3100],
    [70, 48000, 42000],
  ],
};

const weightCols = {
  name: "FedEx Export",
  rows: [
    ["Destination", "0.5", "1", "2", "70"],
    ["Australia", 1900, 2300, 3100, 36000],
    ["Canada", 2100, 2500, 3400, 39000],
  ],
};

const book = parseCourierTariffSheets([exportSheet, importSheet, weightCols], {
  fileName: "FedEx_IP_IE_2026.xlsx",
  year: 2026,
});

assert.equal(book.carrierId, "fedex");
assert.equal(book.year, 2026);
assert.equal(book.maxKg, 70);
assert.ok(book.lanes.length >= 6, `expected lanes, got ${book.lanes.length}`);
assert.ok(book.lanes.every((l) => l.breaks.every((b) => b.kg <= 70)));

const usaExport = book.lanes.find((l) => l.direction === "export" && l.destination === "US");
assert.ok(usaExport, "USA export lane");
assert.equal(pickTariffSlab(usaExport!.breaks, 0.5)?.rate, 2450);
assert.equal(pickTariffSlab(usaExport!.breaks, 0.8)?.rate, 2800);
assert.equal(pickTariffSlab(usaExport!.breaks, 5)?.rate, 6200);

const hit = lookupCourierTariff([book], {
  carrierId: "fedex",
  directoryCarrier: "FDX — FedEx",
  originCountry: "IN",
  destCountry: "US",
  weightKg: 0.8,
  scope: "international",
});
assert.equal(hit.status, "hit");
if (hit.status === "hit") {
  assert.equal(hit.rate, 2800);
  assert.equal(hit.slabKg, 1);
}

const over = lookupCourierTariff([book], {
  carrierId: "fedex",
  originCountry: "IN",
  destCountry: "US",
  weightKg: 500,
});
assert.equal(over.status, "over-max");
if (over.status === "over-max") assert.equal(over.maxKg, COURIER_TARIFF_MAX_KG);

const inbound = lookupCourierTariff([book], {
  carrierId: "fedex",
  originCountry: "US",
  destCountry: "IN",
  weightKg: 1,
});
assert.equal(inbound.status, "hit");
if (inbound.status === "hit") assert.equal(inbound.rate, 3600);

assert.equal(inferCourierCarrier("BLUE DART domestic").id, "bluedart");
assert.equal(inferCourierCarrier("fedex express").id, "fedex");

const empty: CourierTariffBook[] = [];
assert.equal(
  lookupCourierTariff(empty, {
    carrierId: "fedex",
    originCountry: "IN",
    destCountry: "US",
    weightKg: 1,
  }).status,
  "missing",
);

console.log("courier-tariff tests passed");
