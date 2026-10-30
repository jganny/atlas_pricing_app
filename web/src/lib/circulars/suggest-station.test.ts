import assert from "node:assert/strict";
import { suggestStation, suggestStations } from "./suggest-station";

const c = (id: string, title: string, fileName = "", station = "") => ({ id, title, fileName, station });
// Real titles from the library
assert.equal(suggestStation(c("1", "EK_BLR"))?.station.name, "Bangalore");
assert.equal(suggestStation(c("2", "ET_BOM"))?.station.name, "Mumbai");
assert.equal(suggestStation(c("3", "UL_MAA"))?.station.name, "Chennai");
assert.equal(suggestStation(c("4", "SQ_AMD"))?.station.name, "Ahmedabad");
assert.equal(suggestStation(c("5", "EY_BLR(GCR)"))?.station.name, "Bangalore", "brackets are not part of the code");
assert.equal(suggestStation(c("6", "TG_FUEL_BLR"))?.code, "BLR");
assert.equal(suggestStation(c("7", "MH_DEL"))?.station.name, "Delhi");
// The file name is used when the title has no code
const f = suggestStation(c("8", "Air India Agreement", "BOM ET Rates eff. 05 Aug'2026.pdf"));
assert.equal(f?.station.name, "Mumbai");
assert.equal(f?.from, "file name");
assert.equal(suggestStation(c("9", "EK_BLR"))?.from, "title");
// No code, ordinary words, or an already-set station: no suggestion
assert.equal(suggestStation(c("10", "OOCL", "Far East Ports Rate sheet for Dry cargo in Oct 2026.xlsx")), null);
assert.equal(suggestStation(c("11", "ONE RATE SHHET")), null, "ONE is a carrier, not a station");
assert.equal(suggestStation(c("12", "EK_BLR", "", "Chennai")), null, "never overrides a station that is set");
assert.equal(suggestStation(c("13", "Rate Sheet", "delivery note.pdf")), null, "lower-case words are not codes");
// Two different stations in one title is not clear
assert.equal(suggestStation(c("14", "EK BLR to MAA tariff")), null);
// The same station twice is fine
assert.equal(suggestStation(c("15", "BLR - EK BLR tariff"))?.station.name, "Bangalore");
assert.equal(suggestStations([c("a", "EK_BLR"), c("b", "OOCL"), c("c", "ET_BOM")]).length, 2);
console.log("suggest-station tests passed");
