import assert from "node:assert/strict";
import type { CircularRecord } from "@/lib/types";
import { buildFolders, kindOf, roleOf } from "./folders";

const c = (id: string, over: Partial<CircularRecord>): CircularRecord => ({ id, title: id, ...over });
assert.equal(kindOf("airline_tariff"), "airline");
assert.equal(kindOf("fuel_circular_airline"), "airline");
assert.equal(kindOf("sea_tariff"), "liner");
assert.equal(kindOf("line_circular"), "liner");
assert.equal(kindOf("courier_tariff"), "courier");
assert.equal(kindOf("fuel_circular_shipping"), "liner", "a liner's fuel circular sits with the liners");
assert.equal(roleOf("fuel_circular_shipping"), "fsc");
assert.equal(kindOf("general"), "general");
assert.equal(kindOf(undefined), "general");
assert.equal(roleOf("fuel_circular_airline"), "fsc");
assert.equal(roleOf("airline_tariff"), "tariff");

const groups = buildFolders([
  c("ek-fsc", { station: "Bangalore", carrier: "Emirates", category: "fuel_circular_airline", createdAt: "2026-10-01" }),
  c("ek-tariff", { station: "Bangalore", carrier: " emirates ", category: "airline_tariff", createdAt: "2026-09-01" }),
  c("qr-tariff", { station: "Bangalore", carrier: "Qatar Airways", category: "airline_tariff" }),
  c("msc", { station: "Bangalore", carrier: "MSC", category: "sea_tariff" }),
  c("orphan", { carrier: "DHL", category: "courier_tariff" }),
  c("nocarrier", { station: "Bangalore", category: "general" }),
]);
assert.deepEqual(groups.map((g) => g.label), ["Bangalore (BLR)", "Station not set"].map((l) => groups.find((g) => g.label === l)?.label ?? l), "stations first, unlabelled last");
assert.equal(groups.at(-1)?.station, null);
const blr = groups.find((g) => g.station === "Bangalore")!;
assert.deepEqual(blr.kinds.map((k) => k.kind), ["airline", "liner", "general"]);
const air = blr.kinds[0];
assert.deepEqual(air.carriers.map((f) => f.label), ["Emirates", "Qatar Airways"]);
const ek = air.carriers[0];
assert.deepEqual(ek.files.map((f) => f.id), ["ek-tariff", "ek-fsc"], "the tariff and its FSC circular share one folder, tariff first");
assert.equal(ek.hasTariff && ek.hasFsc, true);
assert.equal(air.carriers[1].hasFsc, false);
assert.equal(blr.fileCount, 5);
assert.equal(blr.kinds[2].carriers[0].label, "No carrier set");
console.log("circular folders tests passed");
