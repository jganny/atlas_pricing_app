import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const air = fs.readFileSync(path.join(root, "app/(workspace)/air/page.tsx"), "utf8");
const sea = fs.readFileSync(path.join(root, "app/(workspace)/sea/page.tsx"), "utf8");
const hub = fs.readFileSync(path.join(root, "app/(workspace)/quote/page.tsx"), "utf8");
const drop = fs.readFileSync(path.join(root, "components/QuoteHubDrop.tsx"), "utf8");
const home = fs.readFileSync(path.join(root, "app/(workspace)/page.tsx"), "utf8");

assert.equal(fs.existsSync(path.join(root, "components/DeskSmartQuoteStrip.tsx")), false);
assert.doesNotMatch(air, /Paste enquiry/);
assert.doesNotMatch(sea, /Paste enquiry/);
assert.doesNotMatch(air, /DeskSmartQuoteStrip/);
assert.doesNotMatch(sea, /DeskSmartQuoteStrip/);
assert.match(hub, /Drop the job/);
// One door: Quote Hub is the only place that accepts dropped documents — the desks do not.
assert.match(drop, /onDrop/);
for (const desk of [air, sea]) assert.doesNotMatch(desk, /onDrop=|QuoteHubDrop/);
// Home has one start box (Ask Vertex bar + the same drop as Quote Hub); the desks still take no drops.
const homeStart = fs.readFileSync(path.join(root, "components/HomeStartBox.tsx"), "utf8");
assert.match(home, /HomeStartBox/);
assert.match(homeStart, /VertexAskBar/);

console.log("desk intake: Paste enquiry removed from Air/Sea; Drop the job + Ask Vertex remain");
