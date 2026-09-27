import assert from "node:assert/strict";
import type { AirTariff, SeaTariff } from "@/lib/types";
import { lookupAirTariff, lookupSeaTariff } from "./tariffs";

// More than one tariff can exist for the same lane/carrier (e.g. a
// republished, corrected circular) — lookup must prefer the newer one
// instead of whichever happens to come first in the array.
const stale: AirTariff = {
  id: "old",
  carrier: "Emirates",
  carrierCode: "EK",
  origin: "BOM",
  destination: "DXB",
  breaks: { min: { sell: 100, buy: 90 } },
  currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const fresh: AirTariff = {
  ...stale,
  id: "new",
  breaks: { min: { sell: 120, buy: 100 } },
  createdAt: "2026-09-01T00:00:00.000Z",
};

assert.equal(lookupAirTariff([stale, fresh], "BOM", "DXB", "EK")?.id, "new");
assert.equal(lookupAirTariff([fresh, stale], "BOM", "DXB", "EK")?.id, "new", "order in the array must not matter");

const staleSea: SeaTariff = {
  id: "old",
  carrier: "MSC",
  carrierCode: "MS",
  origin: "INNSA",
  destination: "NLRTM",
  mode: "fcl",
  lclRate: { sell: 0, buy: 0 },
  fclRates: { "20GP": { sell: 1000, buy: 900 } },
  currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const freshSea: SeaTariff = {
  ...staleSea,
  id: "new",
  fclRates: { "20GP": { sell: 1200, buy: 1050 } },
  createdAt: "2026-09-01T00:00:00.000Z",
};
assert.equal(lookupSeaTariff([staleSea, freshSea], "INNSA", "NLRTM", "fcl")?.id, "new");

console.log("tariffs tests passed");
