import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import {
  optionBreakdownsFromQuote,
  uniqueOptionBreakdowns,
  quotePreviewPanelCounts,
} from "./option-breakdown";

const quote: SavedQuote = {
  id: "preview",
  customer: "Zenith",
  creator: "ganny",
  status: "quoted",
  type: "air",
  amount: 1430,
  currency: "USD",
  route: "BOM → GRU · BOM → LHR",
  details: {
    chargeableWeight: 500,
    quotedLanes: [
      {
        laneId: "l1",
        laneLabel: "Lane 1 · BOM → GRU",
        airline: "EK — Emirates SkyCargo",
        amount: 790,
        validity: "2026-09-11",
      },
      {
        laneId: "l2",
        laneLabel: "Lane 2 · BOM → LHR",
        airline: "QR — Qatar Airways Cargo",
        amount: 640,
        validity: "2026-09-20",
      },
    ],
    allLanesTotal: 1430,
    airlines: [
      {
        id: "ek",
        name: "EK — Emirates SkyCargo",
        kind: "airline",
        selected: true,
        quoteTotal: 790,
        baseFreight: 750,
        originFeesTotal: 20,
        destFeesTotal: 20,
        routing: "DXB",
        tt: "4",
        validity: "2026-09-11",
        laneId: "l1",
        laneLabel: "Lane 1 · BOM → GRU",
      },
      {
        id: "ey",
        name: "EY — Etihad Cargo",
        kind: "airline",
        selected: false,
        quoteTotal: 690,
        baseFreight: 650,
        originFeesTotal: 20,
        destFeesTotal: 20,
        routing: "AUH",
        tt: "3",
        validity: "2026-09-09",
        laneId: "l1",
        laneLabel: "Lane 1 · BOM → GRU",
      },
      {
        id: "qr",
        name: "QR — Qatar Airways Cargo",
        kind: "airline",
        selected: true,
        quoteTotal: 640,
        baseFreight: 600,
        originFeesTotal: 20,
        destFeesTotal: 20,
        routing: "DOH",
        tt: "4",
        validity: "2026-09-20",
        laneId: "l2",
        laneLabel: "Lane 2 · BOM → LHR",
      },
    ],
  },
};

const rows = optionBreakdownsFromQuote(quote);
assert.equal(rows.length, 3);
const ey = rows.find((r) => r.id === "ey");
assert.ok(ey);
assert.equal(ey.selected, false);
assert.equal(ey.baseFreight, 650);
assert.equal(ey.total, 690);
assert.equal(ey.validity, "2026-09-09");
const qr = rows.find((r) => r.id === "qr");
assert.ok(qr);
assert.equal(qr.validity, "2026-09-20");
assert.equal(qr.baseFreight, 600);
assert.notEqual(qr.baseFreight, ey.baseFreight, "lanes keep their own freight");

const seaQuote: SavedQuote = {
  id: "s",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "sea",
  amount: 2200,
  currency: "USD",
  details: {
    originFeesTotal: 80,
    destFeesTotal: 40,
    baseFreight: 2080,
    validity: "2026-10-01",
    liners: [
      {
        id: "msc",
        name: "MSC",
        kind: "liner",
        selected: true,
        quoteTotal: 2200,
        baseFreight: 2080,
        originFeesTotal: 80,
        destFeesTotal: 40,
        routing: "Singapore",
        tt: "18",
        validity: "2026-10-01",
      },
      {
        id: "ecu",
        name: "ECU Worldwide",
        kind: "coloader",
        selected: false,
        quoteTotal: 1980,
        baseFreight: 1900,
        originFeesTotal: 50,
        destFeesTotal: 30,
        routing: "CNF",
        tt: "21",
        validity: "2026-09-20",
      },
    ],
  },
};
const seaRows = optionBreakdownsFromQuote(seaQuote);
assert.equal(seaRows.length, 2);
const ecu = seaRows.find((r) => r.id === "ecu");
assert.ok(ecu);
assert.equal(ecu.kind, "coloader");
assert.equal(ecu.baseFreight, 1900);
assert.equal(ecu.appliedRate, 0, "sea coloader must not use air kg×rate");
assert.equal(ecu.ams, 0);
assert.equal(ecu.validity, "2026-09-20");

const courierQuote: SavedQuote = {
  id: "c",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "courier",
  amount: 4840,
  currency: "INR",
  details: {
    carrier: "fedex",
    gstAmount: 740,
    validity: "7 days",
    chargeableWeight: 10,
    carrierQuotes: [
      {
        id: "dhl",
        name: "DHL",
        kind: "courier",
        sellLocal: 3800,
        quoteTotal: 3800,
        ratePerKg: 380,
        transit: "2-3 days",
        selected: false,
      },
      {
        id: "fedex",
        name: "FedEx",
        kind: "courier",
        sellLocal: 4100,
        quoteTotal: 4100,
        ratePerKg: 410,
        gst: 740,
        transit: "2 days",
        selected: true,
        validity: "7 days",
      },
    ],
  },
};
const courierRows = optionBreakdownsFromQuote(courierQuote);
assert.equal(courierRows.find((r) => r.id === "fedex")?.gst, 740);
assert.equal(courierRows.find((r) => r.id === "dhl")?.gst, 0);
assert.equal(courierRows.find((r) => r.id === "dhl")?.appliedRate, 380);

const truckQuote: SavedQuote = {
  id: "t",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "transport",
  amount: 18000,
  currency: "INR",
  details: {
    validity: "15 days",
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
        validity: "15 days",
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
        validity: "10 days",
      },
    ],
  },
};
const truckRows = optionBreakdownsFromQuote(truckQuote);
const hwy = truckRows.find((r) => r.id === "t2");
assert.ok(hwy);
assert.equal(hwy.freightSell, 14000);
assert.equal(hwy.detention, 0);
assert.equal(hwy.tolls, 500);
assert.equal(hwy.validity, "10 days");
assert.equal(hwy.appliedRate, 0);

const whQuote: SavedQuote = {
  id: "w",
  customer: "A",
  creator: "ganny",
  status: "quoted",
  type: "warehouse",
  amount: 8500,
  currency: "INR",
  details: {
    location: "Bhiwandi",
    ratePerCbm: 100,
    cbm: 50,
    days: 7,
    handling: 1500,
    validity: "30 days",
  },
};
const whRows = optionBreakdownsFromQuote(whQuote);
assert.equal(whRows.length, 1);
assert.equal(whRows[0].kind, "warehouse");
assert.equal(whRows[0].storage, 35000);
assert.equal(whRows[0].handling, 1500);
assert.equal(whRows[0].validity, "30 days");

const duped = uniqueOptionBreakdowns([
  { id: "qr", name: "QR", laneId: "l1" },
  { id: "ey", name: "EY", laneId: "l1" },
  { id: "qr", name: "QR", laneId: "l1" },
] as ReturnType<typeof optionBreakdownsFromQuote>);
assert.equal(duped.length, 2);
assert.deepEqual(
  quotePreviewPanelCounts(1),
  { screen: 1, print: 1 },
  "one airline → one on-screen breakup",
);
assert.deepEqual(
  quotePreviewPanelCounts(2),
  { screen: 1, print: 2 },
  "two airlines → one inspect on screen, two in the print pack — never three",
);

console.log("option-breakdown tests passed");
