import assert from "node:assert/strict";
import type { AirTariff, SeaTariff } from "@/lib/types";
import {
  lookupAirTariff,
  lookupAirTariffForCarrier,
  lookupSeaTariff,
  lookupSeaTariffForCarrier,
} from "./tariffs";

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

// lookupAirTariffForCarrier must never silently substitute a different
// carrier's tariff — that's the exact imprecision the desk complained about.
const qatarBomDxb: AirTariff = { ...stale, id: "qatar", carrier: "Qatar Airways Cargo", carrierCode: "QR" };
const laneWithTwoCarriers = [fresh, qatarBomDxb];

const matched = lookupAirTariffForCarrier(laneWithTwoCarriers, "BOM", "DXB", "Emirates");
assert.equal(matched.status, "matched");
assert.equal(matched.status === "matched" && matched.tariff.id, "new");

// Typed carrier isn't on file for this lane, but another one is — must
// report the mismatch, never silently return the wrong carrier's rate.
const mismatch = lookupAirTariffForCarrier(laneWithTwoCarriers, "BOM", "DXB", "Cathay Pacific");
assert.equal(mismatch.status, "carrier-mismatch");
assert.deepEqual(
  mismatch.status === "carrier-mismatch" && [...mismatch.otherCarriers].sort(),
  ["Emirates", "Qatar Airways Cargo"],
);

// Nothing at all on file for the lane.
assert.equal(lookupAirTariffForCarrier([fresh], "DEL", "LHR", "Emirates").status, "none");

// Same rules for Sea, scoped by mode too.
const mscInnsaNlrtm: SeaTariff = freshSea;
const cmaInnsaNlrtm: SeaTariff = { ...staleSea, id: "cma", carrier: "CMA CGM", carrierCode: "CM" };
const seaMatched = lookupSeaTariffForCarrier([mscInnsaNlrtm, cmaInnsaNlrtm], "INNSA", "NLRTM", "MSC", "fcl");
assert.equal(seaMatched.status, "matched");
assert.equal(seaMatched.status === "matched" && seaMatched.tariff.id, "new");

const seaMismatch = lookupSeaTariffForCarrier([mscInnsaNlrtm, cmaInnsaNlrtm], "INNSA", "NLRTM", "Hapag-Lloyd", "fcl");
assert.equal(seaMismatch.status, "carrier-mismatch");

console.log("tariffs tests passed");
