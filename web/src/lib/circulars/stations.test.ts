import assert from "node:assert/strict";
import { STATIONS, STATION_NAMES, stationByName, stationForOrigin, stationLabel } from "./stations";
import { BRANCH_NAMES } from "@/lib/quotes/customs-holidays-2026-seed";

// Every branch the app knows has a station, so no branch can be left out of the labels.
assert.deepEqual([...STATION_NAMES].sort(), [...BRANCH_NAMES].sort());
assert.equal(stationLabel("Bangalore"), "Bangalore (BLR)");
assert.equal(stationLabel("bangalore"), "Bangalore (BLR)");
assert.equal(stationLabel("Somewhere"), "Somewhere", "an unknown name is shown as typed");
assert.equal(stationLabel(""), "");
assert.equal(stationByName("Chennai")?.code, "MAA");

// Origins from tariffs and desks: airports, seaports, with or without the city
assert.equal(stationForOrigin("BLR")?.name, "Bangalore");
assert.equal(stationForOrigin("blr - Bengaluru")?.name, "Bangalore");
assert.equal(stationForOrigin("INMAA - Chennai")?.name, "Chennai");
assert.equal(stationForOrigin("INNSA")?.name, "Mumbai", "Nhava Sheva is Mumbai");
assert.equal(stationForOrigin("DXB"), undefined, "a foreign airport has no Atlas station");
assert.equal(stationForOrigin(""), undefined);

// No code points at two stations
const seen = new Map<string, string>();
for (const s of STATIONS) for (const c of [s.code, ...s.air, ...s.sea]) {
  assert.ok(!seen.has(c) || seen.get(c) === s.name, `${c} belongs to both ${seen.get(c)} and ${s.name}`);
  seen.set(c, s.name);
}
console.log("stations tests passed");
