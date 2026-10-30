import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, "../app/globals.css"), "utf8");
const emblem = fs.readFileSync(path.join(here, "../components/VertexEmblem.tsx"), "utf8");

// Every animation the emblem uses exists, and all of them stop for people who ask for reduced motion.
for (const name of ["vx-float", "vx-stride", "vx-pulse"]) assert.match(css, new RegExp(`@keyframes ${name}\\b`), `${name} keyframes`);
const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
for (const cls of [".vx-tilt", ".vx-arc", ".vx-glow"]) assert.ok(reduced.includes(cls), `${cls} stops under reduced motion`);
assert.match(reduced, /\.vx-follow[\s\S]*transform: none/, "pointer-lean is switched off too");

// Three arcs, one bindu: the emblem is the Three Strides.
assert.equal((emblem.match(/className="vx-arc vx-arc-\d"/g) || []).length, 3);
// Decorative layers are hidden from screen readers; the emblem as a whole is announced once.
assert.match(emblem, /aria-label="Vertex"/);
console.log("vertex-emblem contract passed");
