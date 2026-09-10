import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const air = fs.readFileSync(path.join(root, "app/(workspace)/air/page.tsx"), "utf8");
const sea = fs.readFileSync(path.join(root, "app/(workspace)/sea/page.tsx"), "utf8");
const hub = fs.readFileSync(path.join(root, "components/QuoteHubIntake.tsx"), "utf8");
const home = fs.readFileSync(path.join(root, "app/(workspace)/page.tsx"), "utf8");

assert.equal(fs.existsSync(path.join(root, "components/DeskSmartQuoteStrip.tsx")), false);
assert.doesNotMatch(air, /Paste enquiry/);
assert.doesNotMatch(sea, /Paste enquiry/);
assert.doesNotMatch(air, /DeskSmartQuoteStrip/);
assert.doesNotMatch(sea, /DeskSmartQuoteStrip/);
assert.match(hub, /Drop the job/);
assert.match(home, /VertexAskBar/);

console.log("desk intake: Paste enquiry removed from Air/Sea; Drop the job + Ask Vertex remain");
