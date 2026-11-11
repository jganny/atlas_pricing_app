import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const home = read("app/(workspace)/page.tsx");
const shell = read("components/AppShell.tsx");
const workBar = read("components/WorkBar.tsx");
const board = read("components/TeamBoard.tsx");

assert.doesNotMatch(home, /Atlas workbench/i);
assert.doesNotMatch(home, /Manager overview/);
assert.doesNotMatch(home, /home-phone-shortcuts/);
assert.doesNotMatch(home, /tint\(/);
assert.doesNotMatch(home, /Sparkles/);
assert.match(home, /data-testid="home-page"/);
assert.match(home, /data-testid="home-next"/);
assert.match(home, /homeGreeting/);
assert.match(home, /#0078d4/);

assert.match(shell, /normalized === "\/"/, "Home is a full page, not a padded card");
assert.match(workBar, /path === "\/"/, "the red work bar does not sit on Home — Home has its own next line");
assert.doesNotMatch(board, /bg-red-50/, "Needs attention is a quiet line, not a pink dump");
assert.match(board, /data-testid="needs-attention"/);

console.log("home dignity contract ok");
