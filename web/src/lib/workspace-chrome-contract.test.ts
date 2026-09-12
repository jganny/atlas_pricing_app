import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");
const banner = fs.readFileSync(path.join(root, "components/MockBanner.tsx"), "utf8");

assert.doesNotMatch(shell, /NewsTicker/);
assert.doesNotMatch(shell, />\s*Legacy\s*</);
assert.match(shell, /workspace-tools/);
assert.match(shell, /WorkspaceMore/);
assert.match(shell, /backdrop-blur-xl/);
assert.doesNotMatch(banner, /awaiting cutover approval/);
assert.doesNotMatch(banner, /Live Firebase/);
assert.match(banner, /demo data only/);

console.log("workspace chrome: quiet header — no ticker, no cutover banner, tools clustered");
