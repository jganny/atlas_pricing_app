import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const core = path.join(web, "../packages/pricing-core/src/courier/constants.ts");
const courierPage = fs.readFileSync(path.join(web, "src/app/(workspace)/courier/page.tsx"), "utf8");
const fx = fs.readFileSync(path.join(web, "src/components/ShellChrome.tsx"), "utf8");
const src = fs.readFileSync(core, "utf8");

assert.match(src, /volumeWeight = volPerPiece \* qty/);
assert.match(src, /Math\.max\(gw, volumeWeight\)/);
assert.doesNotMatch(src, /chargeablePerPiece\) \* qty/);
assert.match(courierPage, /data-testid="courier-vwt"/);
assert.match(courierPage, /data-testid="courier-chw"/);
assert.match(fx, /data-testid="fx-rates"/);
assert.match(fx, /USD \{rates\.USD\.toFixed\(2\)\} · EUR \{rates\.EUR\.toFixed\(2\)\} · GBP \{rates\.GBP\.toFixed\(2\)\}/);

console.log("courier CHW = max(GW, VWT); header FX shows USD EUR GBP");
