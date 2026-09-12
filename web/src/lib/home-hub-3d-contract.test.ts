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
const intake = fs.readFileSync(path.join(web, "src/components/QuoteHubIntake.tsx"), "utf8");

assert.ok(pkg.dependencies.three, "three is the 3D engine");
assert.ok(pkg.dependencies["@react-three/fiber"], "R3F wraps Three.js for React");
assert.equal(pkg.dependencies["@babylonjs/core"], undefined, "do not add Babylon.js beside Three.js");
assert.match(hub, /HubHero/);
assert.match(hub, /Dump the job\. Vertex routes it/);
assert.match(hub, /atlas-frost/);
assert.match(home, /CartonTokens/);
assert.match(home, /VertexAskBar/);
assert.doesNotMatch(home, /motion-sample/);
assert.match(shell, /normalized === "\/quote"/);
assert.match(css, /atlas-frost/);
assert.match(intake, /frosted/);

console.log("home + quote hub: L3 Three.js hero, carton tokens, frost cards");
