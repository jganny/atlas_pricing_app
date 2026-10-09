import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(web, "package.json"), "utf8"));
const hub = fs.readFileSync(path.join(web, "src/app/(workspace)/quote/page.tsx"), "utf8");
const home = fs.readFileSync(path.join(web, "src/app/(workspace)/page.tsx"), "utf8");
const shell = fs.readFileSync(path.join(web, "src/components/AppShell.tsx"), "utf8");
const css = fs.readFileSync(path.join(web, "src/app/globals.css"), "utf8");
const drop = fs.readFileSync(path.join(web, "src/components/QuoteHubDrop.tsx"), "utf8");

assert.ok(pkg.dependencies.three, "three is the 3D engine");
assert.ok(pkg.dependencies["@react-three/fiber"], "R3F wraps Three.js for React");
assert.equal(pkg.dependencies["@babylonjs/core"], undefined, "do not add Babylon.js beside Three.js");
assert.match(hub, /HubHero/);
assert.match(hub, /Drop the job\. Vertex reads it/);
assert.match(hub, /QuoteHubDrop/);
assert.match(hub, /WaitingJobs/);
assert.match(hub, /atlas-frost/);
assert.doesNotMatch(home, /CartonTokens/, "the decorative carton box was replaced by the Sea desk container view");
assert.match(home, /VertexAskBar/);
assert.doesNotMatch(home, /motion-sample/);
assert.match(shell, /normalized === "\/quote"/);
assert.match(css, /atlas-frost/);
assert.match(drop, /atlas-frost/);

console.log("home + quote hub: L3 Three.js hero, frost cards");
