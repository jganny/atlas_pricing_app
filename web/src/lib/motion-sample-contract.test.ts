import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(web, "package.json"), "utf8"));
const motion = fs.readFileSync(path.join(web, "src/app/(workspace)/motion/page.tsx"), "utf8");
const buttons = fs.readFileSync(path.join(web, "src/components/ui.tsx"), "utf8");
const css = fs.readFileSync(path.join(web, "src/app/globals.css"), "utf8");

assert.ok(pkg.dependencies.three, "three is the 3D engine");
assert.ok(pkg.dependencies["@react-three/fiber"], "R3F wraps Three.js for React");
assert.equal(pkg.dependencies["@babylonjs/core"], undefined, "do not add Babylon.js beside Three.js");
assert.match(motion, /Three ways the page can move/);
assert.match(motion, /CraftCanvas/);
assert.match(buttons, /atlas-pop/);
assert.match(css, /atlas-pop/);
assert.match(css, /atlas-page-card/);
assert.match(css, /scroll-behavior: smooth/);

console.log("motion sample: Three.js only, pop buttons, smooth scroll CSS");
