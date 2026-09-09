import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import { optionBreakdownsFromQuote } from "./option-breakdown";

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

console.log("option-breakdown tests passed");
