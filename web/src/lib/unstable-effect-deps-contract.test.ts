import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard. `const { data: rows = [] } = useSomething()` creates a NEW array on
 * every render while the query is still loading. If `rows` is a dependency of an effect,
 * the effect re-runs every render — with state updates inside, that is an infinite loop
 * ("Maximum update depth exceeded", React error #185). This took down the Air and Sea
 * desks in v0.3.52. Use a module-level constant (or `data ?? NONE`) for the fallback.
 */
const root = new URL("..", import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) && !p.includes(".test.") ? [p] : [];
  });
}

const offenders: string[] = [];
for (const file of walk(root)) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/\{\s*data:\s*(\w+)\s*=\s*\[\]/g)) {
    const name = m[1]!;
    for (const e of src.matchAll(/use(?:Layout)?Effect\(\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\},\s*\[([^\]]*)\]\s*\)/g)) {
      if (new RegExp(`\\b${name}\\b`).test(e[1]!)) offenders.push(`${file.replace(root, "")}: "${name}" is an effect dependency with an unstable [] default`);
    }
  }
}
assert.deepEqual(offenders, [], offenders.join("\n"));
console.log("unstable-effect-deps-contract.test.ts: all assertions passed");
