import assert from "node:assert/strict";
import type { SavedQuote } from "@/lib/types";
import { vendorRowsFromQuote, vendorRowsFromEntries } from "./vendor-preview";

function airQuote(): SavedQuote {
  return {
    id: "preview",
    customer: "Zenith",
    creator: "ganny",
    status: "quoted",
    type: "air",
    amount: 790,
    currency: "USD",
    route: "BLR → LHR via EK",
    details: {
      airline: "EK - Emirates SkyCargo",
      airlines: [
        {
          id: "ek",
          name: "EK - Emirates SkyCargo",
          kind: "airline",
          selected: true,
          quoteTotal: 790,
          routing: "BLR-DXB-LHR",
          tt: "3",
        },
        {
          id: "ey",
          name: "EY - Etihad Cargo",
          kind: "airline",
          selected: false,
          quoteTotal: 640,
          routing: "BLR-AUH-LHR",
          tt: "2",
        },
      ],
    },
  };
}

const air = vendorRowsFromQuote(airQuote());
assert.equal(air.length, 2, "preview lists both airlines");
assert.equal(air[0].name, "EY - Etihad Cargo");
assert.equal(air[0].cheapest, true);
assert.equal(air[0].selected, false);
assert.equal(air[0].total, 640);
assert.equal(air[1].name, "EK - Emirates SkyCargo");
assert.equal(air[1].selected, true);
assert.equal(air[1].cheapest, false);
assert.equal(air[1].total, 790);

const sea = vendorRowsFromQuote({
  id: "s",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "sea",
  amount: 2200,
  currency: "USD",
  details: {
    liner: "MSC",
    type: "lcl",
    liners: [
      { id: "msc", name: "MSC", kind: "liner", selected: true, quoteTotal: 2200 },
      { id: "mae", name: "Maersk", kind: "liner", selected: false, quoteTotal: 1980 },
      { id: "ecu", name: "ECU Worldwide", kind: "coloader", selected: false, quoteTotal: 2100 },
    ],
  },
});
assert.equal(sea.length, 3);
assert.equal(sea[0].name, "Maersk");
assert.equal(sea[0].cheapest, true);
assert.equal(sea.find((r) => r.kind === "coloader")?.kindLabel, "Coloader");
assert.equal(sea.find((r) => r.selected)?.name, "MSC");

const courier = vendorRowsFromQuote({
  id: "c",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "courier",
  amount: 4100,
  currency: "INR",
  details: {
    carrier: "fedex",
    carrierName: "FedEx",
    carrierQuotes: [
      { id: "dhl", name: "DHL", sellLocal: 3800, transit: "2-3 days" },
      { id: "fedex", name: "FedEx", sellLocal: 4100, transit: "2 days" },
      { id: "ups", name: "UPS", sellLocal: 4500, transit: "3 days" },
    ],
  },
});
assert.equal(courier.length, 3);
assert.equal(courier[0].name, "DHL");
assert.equal(courier[0].cheapest, true);
assert.equal(courier.find((r) => r.selected)?.name, "FedEx");

const truck = vendorRowsFromQuote({
  id: "t",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "transport",
  amount: 18000,
  currency: "INR",
  details: {
    truckerName: "Local cartage",
    truckers: [
      {
        id: "t1",
        name: "Local cartage",
        kind: "trucker",
        selected: true,
        freightSell: 15000,
        detention: 2000,
        tolls: 1000,
        quoteTotal: 18000,
      },
      {
        id: "t2",
        name: "Highway Express",
        kind: "trucker",
        selected: false,
        freightSell: 14000,
        detention: 0,
        tolls: 500,
        quoteTotal: 14500,
      },
    ],
  },
});
assert.equal(truck.length, 2);
assert.equal(truck[0].name, "Highway Express");
assert.equal(truck[0].cheapest, true);
assert.equal(truck[1].selected, true);

const fromDesk = vendorRowsFromEntries([
  { id: "a", name: "QR", kind: "airline", total: 900, selected: true },
  { id: "b", name: "EY", kind: "airline", total: 700, selected: false },
]);
assert.equal(fromDesk[0].name, "EY");
assert.equal(fromDesk[0].cheapest, true);

const merged = vendorRowsFromQuote({
  id: "old",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "air",
  amount: 790,
  currency: "USD",
  details: {
    airline: "EK",
    airlines: [{ id: "ek", name: "EK", kind: "airline", selected: true, quoteTotal: 790 }],
    alternatives: [{ name: "EY - Etihad Cargo", quoteTotal: 640 }],
  },
});
assert.equal(merged.length, 2);
assert.equal(merged[0].name, "EY - Etihad Cargo");
assert.equal(merged[0].cheapest, true);

const multiLane = vendorRowsFromQuote({
  id: "m",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "air",
  amount: 900,
  currency: "USD",
  details: {
    lanes: [
      { id: "l1", origin: "BOM", destination: "CMB" },
      { id: "l2", origin: "DEL", destination: "LHR" },
    ],
    quotedLanes: [
      { laneId: "l1", laneLabel: "Lane 1 · BOM → CMB", airline: "UL — SriLankan Airlines", amount: 400 },
      { laneId: "l2", laneLabel: "Lane 2 · DEL → LHR", airline: "EK — Emirates SkyCargo", amount: 500 },
    ],
    airlines: [
      { id: "ul", name: "UL — SriLankan Airlines", selected: true, quoteTotal: 400, laneId: "l1" },
      { id: "ek", name: "EK — Emirates SkyCargo", selected: true, quoteTotal: 500, laneId: "l2" },
    ],
  },
});
assert.equal(multiLane.length, 2);
assert.equal(multiLane.filter((r) => r.cheapest).length, 2, "each lane has its own cheapest star");
assert.ok(multiLane.every((r) => (r.laneLabel || "").startsWith("Lane")));

console.log("vendor-preview tests passed");
