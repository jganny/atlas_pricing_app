import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const swPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/sw.js");
const src = fs.readFileSync(swPath, "utf8");

assert.match(src, /atlas-app-shell-v34/);
assert.match(src, /event\.data\.type === "SKIP_WAITING"/);
assert.match(src, /networkFirst/);
assert.equal(
  (src.match(/self\.skipWaiting/g) || []).length,
  1,
  "skipWaiting only from the SKIP_WAITING message",
);
assert.ok(
  src.indexOf("self.addEventListener(\"message\"") < src.indexOf("self.skipWaiting"),
  "skipWaiting must live in the message handler",
);
assert.equal(src.includes("clients.claim"), false, "claim during activate reloads Safari mid-load");

assert.match(src, /addEventListener\("push"/, "chat alerts need a push handler");
assert.match(src, /addEventListener\("notificationclick"/);
assert.match(src, /visibilityState === "visible"/, "no pop-up while Atlas is on screen");

assert.match(src, /startsWith\("\/app\/_next\/static\/"\)/, "hash-named files come from the device cache");
assert.match(src, /atlas-static-v1/);
assert.match(src, /text\\\/html/, "an HTML fallback page is never cached as a script");
assert.match(src, /k !== "atlas-static-v1"/, "the static cache survives the shell cache cleanup");

console.log("sw.js contract tests passed");
