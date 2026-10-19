import assert from "node:assert/strict";
import { autoAirlines, autoLiners, MAX_AUTO_CARRIERS } from "./auto-carriers";
import type { AirTariff, SeaTariff } from "@/lib/types";

const air = (o: Partial<AirTariff>): AirTariff => ({
  id: "t", carrier: "Emirates", carrierCode: "EK", origin: "BOM", destination: "BEY", currency: "USD",
  breaks: { "plus45": { sell: 3.2, buy: 2.8 }, "plus100": { sell: 2.9, buy: 2.5 } }, createdAt: "2026-10-01", ...o,
});

// Every carrier with a rate on the lane is added, first one selected.
const t = [air({}), air({ id: "2", carrier: "Qatar Airways", carrierCode: "QR", createdAt: "2026-10-05" }), air({ id: "3", destination: "DXB" })];
const r = autoAirlines(t, "BOM", "BEY", { laneId: "L1" });
assert.deepEqual(r.options.map((o) => o.name).sort(), ["Emirates", "Qatar Airways"], "other lanes are not added");
assert.equal(r.options.filter((o) => o.selected).length, 1);
assert.equal(r.options[0].laneId, "L1");
assert.equal(r.options[0].breaks["plus45"]?.sell, 3.2);
assert.equal(r.currency, "USD");

// The newest tariff per carrier wins; tariffs with no rate are ignored.
const newer = autoAirlines([air({ createdAt: "2026-09-01", breaks: { "plus45": { sell: 9, buy: 8 } } }), air({ id: "n", createdAt: "2026-10-09" })], "BOM", "BEY");
assert.equal(newer.options.length, 1);
assert.equal(newer.options[0].breaks["plus45"]?.sell, 3.2);
assert.equal(autoAirlines([air({ breaks: {} })], "BOM", "BEY").options.length, 0, "no rate, no carrier");

// Carriers the user already named are left alone, and the first added one is not auto-selected then.
const have = autoAirlines(t, "BOM", "BEY", { alreadyNamed: ["emirates"] });
assert.deepEqual(have.options.map((o) => o.name), ["Qatar Airways"]);
assert.equal(have.options[0].selected, false);

// A different currency is reported, not mixed in.
const mixed = autoAirlines([air({}), air({ id: "e", carrier: "Etihad", currency: "EUR", createdAt: "2026-09-30" })], "BOM", "BEY");
assert.deepEqual(mixed.skipped, ["Etihad"]);
assert.equal(mixed.options.length, 1);

// Capped, and nothing without both airports.
const many = Array.from({ length: 10 }, (_, i) => air({ id: `m${i}`, carrier: `Carrier ${i}` }));
assert.equal(autoAirlines(many, "BOM", "BEY").options.length, MAX_AUTO_CARRIERS);
assert.equal(autoAirlines(t, "", "BEY").options.length, 0);

// Sea: same rules, by mode, with the shipment's containers on every liner.
const sea = (o: Partial<SeaTariff>): SeaTariff => ({
  id: "s", carrier: "MSC", carrierCode: "MSC", origin: "INMAA", destination: "AEJEA", mode: "fcl", currency: "USD",
  lclRate: { sell: 0, buy: 0 }, fclRates: { "20'GP": { sell: 900, buy: 800 } }, createdAt: "2026-10-01", ...o,
});
const rows = [{ type: "20'GP", qty: 2, sellRate: 123, buyRate: 99 }];
const s = autoLiners([sea({}), sea({ id: "2", carrier: "Maersk", mode: "lcl" }), sea({ id: "3", carrier: "CMA", fclRates: {} })], "INMAA", "AEJEA", "fcl", { containers: rows });
assert.deepEqual(s.options.map((o) => o.name), ["MSC"], "only FCL carriers with a rate");
assert.deepEqual(s.options[0].containers, [{ type: "20'GP", qty: 2, sellRate: 0, buyRate: 0 }], "same container, rates left for the tariff fill");
console.log("auto-carriers tests passed");
