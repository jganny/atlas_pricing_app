#!/usr/bin/env node
// Runs every src/**/*.test.ts (plain node:assert files) with tsx, in parallel,
// and exits non-zero if any fail — so `npm test` and CI share one definition.
import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cpus } from "node:os";

const root = new URL("../src", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".test.ts") ? [p] : [];
  });
}

const files = walk(root).sort();
const results = [];
let next = 0;

function run(file) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", file], { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ file: relative(join(root, ".."), file), ok: code === 0, out }));
  });
}

async function worker() {
  while (next < files.length) {
    const file = files[next++];
    const r = await run(file);
    results.push(r);
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.file}`);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: Math.max(2, Math.min(cpus().length, 6)) }, worker));

const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`\n--- ${r.file} ---\n${r.out.trim()}`);
console.log(`\n${results.length - failed.length}/${results.length} test files passed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(failed.length ? 1 : 0);
