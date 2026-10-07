import assert from "node:assert/strict";
import { isRelaxedImportQuote } from "./relaxed-save";
import { validateSelectedAirline } from "./air-desk";
import { validateSelectedLiner } from "./sea-desk";
import { createAirlineOption, createLinerOption } from "./carrier-options";

// Only import + DDP/DAP/DDU is relaxed
assert.equal(isRelaxedImportQuote("import", "DDP"), true);
assert.equal(isRelaxedImportQuote("import", "dap"), true);
assert.equal(isRelaxedImportQuote("import", " DDU "), true);
assert.equal(isRelaxedImportQuote("import", "CIF"), false);
assert.equal(isRelaxedImportQuote("import", "FOB"), false);
assert.equal(isRelaxedImportQuote("export", "DDP"), false);
assert.equal(isRelaxedImportQuote("export", "DAP"), false);

// Air: normally routing/transit/validity are compulsory
const air = createAirlineOption({ name: "Emirates SkyCargo" }, true);
assert.match(validateSelectedAirline(air) ?? "", /routing/i);
// relaxed: saves with them blank…
assert.equal(validateSelectedAirline(air, true), null);
// …but still needs an option and a carrier name
assert.ok(validateSelectedAirline(undefined, true));
assert.match(validateSelectedAirline(createAirlineOption({}, true), true) ?? "", /carrier/i);

// Sea FCL: normally needs routing/transit/validity and a rate on every container row
const sea = createLinerOption({ name: "Maersk" }, true);
assert.ok(validateSelectedLiner(sea, "fcl"));
assert.equal(validateSelectedLiner(sea, "fcl", true), null);
assert.equal(validateSelectedLiner(sea, "lcl", true), null);
assert.ok(validateSelectedLiner(undefined, "fcl", true));
assert.match(validateSelectedLiner(createLinerOption({}, true), "fcl", true) ?? "", /liner/i);

// A fully filled option stays valid either way
const full = createAirlineOption(
  { name: "EK", routing: "BOM-DXB-LHR", tt: "3 days", validity: "15 days" },
  true,
);
assert.equal(validateSelectedAirline(full), null);
assert.equal(validateSelectedAirline(full, true), null);

console.log("relaxed-save.test.ts: all assertions passed");
