import assert from "node:assert/strict";
import {
  inferCourierCarrier,
  lookupCourierTariff,
  parseCourierTariffSheets,
  pickTariffSlab,
  applyCourierTariffMarkup,
  courierTariffNeedsReupload,
  repairCourierTariffBook,
  dedupeCourierTariffBooks,
  COURIER_TARIFF_MAX_KG,
  COURIER_TARIFF_MARKUP_PCT,
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
assert.equal(inferCourierCarrier("FedEx").id, "fedex");
assert.equal(inferCourierCarrier("FX — FedEx Express").id, "fedex");

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

const fedexZoneRates = {
  name: "EXPORT FEDEX RATES 1.0",
  rows: [
    ["FEDEX EXPORT TARIFF JAN–DEC 2026"],
    ["Weight (kg)", "Zone A", "Zone B", "Zone C"],
    [0.5, 1331, 1443, 1548],
    [1, 1600, 1750, 1900],
    [5, 4200, 4600, 5100],
    [70, 28000, 31000, 35000],
    [100, 40000, 45000, 50000],
  ],
};

const fedexZoneChart = {
  name: "Country Zone",
  rows: [
    ["Country", "Zone"],
    ["United States", "A"],
    ["Canada", "A"],
    ["United Kingdom", "B"],
    ["Germany", "B"],
    ["UAE", "C"],
    ["Singapore", "C"],
    ["Australia", "C"],
    ["France", "B"],
  ],
};

const zoneBook = parseCourierTariffSheets([fedexZoneRates, fedexZoneChart], {
  fileName: "EXPORT FEDEX RATES 1.0.xlsx",
  year: 2026,
});

assert.equal(zoneBook.carrierId, "fedex");
assert.ok(
  zoneBook.lanes.every((l) => !/^\d+$/.test(l.destination)),
  `destinations should be zones/countries, got ${zoneBook.lanes.map((l) => l.destination).join(",")}`,
);
const zoneA = zoneBook.lanes.find((l) => l.direction === "export" && l.destination === "ZONE-A");
assert.ok(zoneA, `expected ZONE-A lane, got ${zoneBook.lanes.map((l) => l.destination).join(",")}`);
assert.equal(pickTariffSlab(zoneA!.breaks, 0.5)?.rate, 1331);
assert.equal(pickTariffSlab(zoneA!.breaks, 0.8)?.rate, 1600);
assert.equal(zoneBook.zoneMap?.US, "ZONE-A");
assert.equal(zoneBook.zoneMap?.GB, "ZONE-B");
assert.equal(courierTariffNeedsReupload(zoneBook), false);

const zoneHit = lookupCourierTariff([zoneBook], {
  carrierId: "dhl",
  directoryCarrier: "FedEx",
  originCountry: "IN",
  destCountry: "IN",
  destText: "New York",
  weightKg: 12,
  scope: "domestic",
});
assert.equal(zoneHit.status, "hit", "city New York + FedEx should resolve US → Zone A even if dest country still IN");
if (zoneHit.status === "hit") {
  assert.equal(zoneHit.rate, 28000);
  assert.equal(zoneHit.slabKg, 70);
}

assert.equal(COURIER_TARIFF_MARKUP_PCT, 5);
assert.equal(applyCourierTariffMarkup(1331), 1397.55);
assert.equal(applyCourierTariffMarkup(1600), 1680);

const numericHeaderBook = parseCourierTariffSheets(
  [
    {
      name: "EXPORT FEDEX RATES",
      rows: [
        ["Weight (kg)", "Zone A", "Zone B"],
        [0.5, 1331, 1443],
        [1, 1600, 1750],
      ],
    },
  ],
  { fileName: "EXPORT FEDEX RATES 1.0.xlsx" },
);
assert.ok(
  numericHeaderBook.lanes.every((l) => !/^\d+$/.test(l.destination)),
  "must not treat 1331/1443 as destinations",
);
assert.ok(numericHeaderBook.lanes.some((l) => l.destination === "ZONE-A"));

const importZones = parseCourierTariffSheets(
  [
    {
      name: "IMPORTS RATES 1.0",
      rows: [
        ["Kg", "Zone A", "Zone B"],
        [1, 3600, 3100],
        [70, 48000, 42000],
      ],
    },
    fedexZoneChart,
  ],
  { fileName: "IMPORTS RATES 1.0.xlsx" },
);
const importHit = lookupCourierTariff([importZones], {
  directoryCarrier: "FDX — FedEx",
  originCountry: "US",
  destCountry: "IN",
  weightKg: 1,
});
assert.equal(importHit.status, "hit");
if (importHit.status === "hit") assert.equal(importHit.rate, 3600);

const subheaderBook = parseCourierTariffSheets(
  [
    {
      name: "Export",
      rows: [
        ["Weight", "A", "B"],
        ["", "USA, Canada", "United Kingdom"],
        [0.5, 1000, 2000],
        [1, 1500, 2500],
      ],
    },
  ],
  { fileName: "fedex.xlsx" },
);
assert.equal(subheaderBook.zoneMap?.US, "ZONE-A");
assert.equal(subheaderBook.zoneMap?.GB, "ZONE-B");
const subHit = lookupCourierTariff([subheaderBook], {
  carrierId: "fedex",
  originCountry: "IN",
  destCountry: "US",
  weightKg: 0.5,
});
assert.equal(subHit.status, "hit");
if (subHit.status === "hit") assert.equal(subHit.rate, 1000);

const broken: CourierTariffBook = {
  id: "broken",
  carrier: "FedEx",
  carrierCode: "FDX",
  carrierId: "fedex",
  year: 2026,
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  currency: "INR",
  maxKg: 70,
  uploadedAt: "2026-09-12",
  lanes: [
    { origin: "IN", destination: "1331", destinationLabel: "1331", direction: "export", breaks: [{ kg: 1, rate: 1600 }] },
  ],
};
assert.equal(courierTariffNeedsReupload(broken), true);
assert.equal(
  lookupCourierTariff([broken], {
    carrierId: "fedex",
    originCountry: "IN",
    destCountry: "US",
    weightKg: 1,
  }).status,
  "missing",
);

const liveStyleDests = [1331, 1443, 1548, 1547, 1783, 1982, 1985, 1676, 2117, 1974, 1658, 1871, 1418, 2091];
const liveExport: CourierTariffBook = {
  id: "export-live",
  carrier: "FedEx",
  carrierCode: "FDX",
  carrierId: "fedex",
  year: 2026,
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
  currency: "INR",
  maxKg: 70,
  uploadedAt: "2026-09-12T20:30:13.029Z",
  fileName: "EXPORT FEDEX RATES 1.0.xlsx",
  lanes: liveStyleDests.map((rate, i) => ({
    origin: "IN",
    destination: String(rate),
    destinationLabel: String(rate),
    direction: "export" as const,
    breaks: [
      { kg: 1, rate: rate + 100 },
      { kg: 50, rate: 20000 + i * 1000 },
      { kg: 70, rate: 28000 + i * 1000 },
    ],
  })),
};
assert.equal(repairCourierTariffBook(liveExport).lanes[3].destination, "ZONE-D");
const london = lookupCourierTariff([liveExport], {
  carrierId: "dhl",
  directoryCarrier: "FDX — FedEx",
  originCountry: "IN",
  destCountry: "GB",
  destText: "London",
  weightKg: 50,
});
assert.equal(london.status, "hit", "India → London 50 kg must fill from the 4th recovered FedEx zone");
if (london.status === "hit") {
  assert.equal(london.rate, 23000);
  assert.equal(london.lane.destinationLabel, "Zone D");
  assert.equal(applyCourierTariffMarkup(london.rate), 24150);
}

const dup = dedupeCourierTariffBooks([
  liveExport,
  { ...liveExport, id: "export-dup", uploadedAt: "2026-09-12T21:00:00.000Z", fileName: "EXPORT FEDEX RATES 1.0.xlsx" },
]);
assert.equal(dup.length, 1);
assert.equal(dup[0].id, "export-dup");

console.log("courier-tariff tests passed");
