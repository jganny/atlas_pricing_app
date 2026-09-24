import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const core = path.join(web, "../packages/pricing-core/src/courier/constants.ts");
const courierPage = fs.readFileSync(path.join(web, "src/app/(workspace)/courier/page.tsx"), "utf8");
const fx = fs.readFileSync(path.join(web, "src/components/ShellChrome.tsx"), "utf8");
const src = fs.readFileSync(core, "utf8");

// GW is per piece (matches the live legacy courier desk: courier-desk.js
// chargeablePerPiece = max(gw, volPerPiece); round(chargeablePerPiece) * qty)
// — a prior version of this contract locked in the OPPOSITE, treating GW as
// the line's total and never multiplying by qty, which silently under-priced
// any multi-piece line where GW decided. volumeWeight (qty-multiplied) still
// exists for the on-screen VWT column — it's just not what CHW is built from.
assert.match(src, /volumeWeight = volPerPiece \* qty/);
assert.match(src, /chargeablePerPiece = roundChargeableKg\(Math\.max\(gw, volPerPiece\)\)/);
assert.match(src, /chargeable = chargeablePerPiece \* qty/);
assert.doesNotMatch(src, /roundChargeableKg\(Math\.max\(gw, volumeWeight\)\)/);
assert.match(courierPage, /data-testid="courier-vwt"/);
assert.match(courierPage, /data-testid="courier-chw"/);
assert.match(fx, /data-testid="fx-rates"/);
assert.match(fx, /USD \{rates\.USD\.toFixed\(2\)\} · EUR \{rates\.EUR\.toFixed\(2\)\} · GBP \{rates\.GBP\.toFixed\(2\)\}/);

console.log("courier CHW = max(GW, volumetric) per piece, then × qty (matches legacy); header FX shows USD EUR GBP");
