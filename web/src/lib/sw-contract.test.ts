import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const swPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/sw.js");
const src = fs.readFileSync(swPath, "utf8");

assert.match(src, /atlas-app-shell-v27/);
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

console.log("sw.js contract tests passed");
