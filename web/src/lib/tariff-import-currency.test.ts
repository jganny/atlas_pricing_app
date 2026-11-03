import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTariffImportRows } from "./firebase/circulars";

// A sheet's own currency column is honoured; with no column the currency stays empty (the desk chooses), never "USD".
const withCol = parseTariffImportRows([{ Origin: "BOM", Destination: "DXB", Carrier: "EK", Sell: 3.1, Currency: "inr" }]);
assert.equal(withCol[0].currency, "INR");
const noCol = parseTariffImportRows([{ Origin: "BOM", Destination: "DXB", Carrier: "EK", Sell: 3.1 }]);
assert.equal(noCol[0].currency, "");
assert.equal(parseTariffImportRows([{ Origin: "BOM", Destination: "DXB", Sell: 1, Currency: "rupees" }])[0].currency, "");

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "firebase/circulars.ts"), "utf8");
const publish = src.slice(src.indexOf("export async function publishAirTariffRows"), src.indexOf("export async function publishAirTariffBreaks"));
assert.doesNotMatch(publish, /currency: "USD"/, "the sheet import must not force dollars");
assert.match(publish, /currency: row\.currency/);
console.log("tariff import: currency comes from the sheet or the desk, never assumed");
