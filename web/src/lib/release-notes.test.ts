import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_NOTES, baseVersion, notesFor } from "./release-notes";

assert.equal(baseVersion("0.3.119-test-app"), "0.3.119");
assert.equal(baseVersion("0.3.119-demo"), "0.3.119");
assert.equal(notesFor("0.3.118-test-app")?.version, "0.3.118");
assert.equal(notesFor("9.9.9"), undefined);

// Newest first, no duplicates, every entry says something
const versions = RELEASE_NOTES.map((n) => n.version);
assert.equal(new Set(versions).size, versions.length, "one entry per version");
const key = (v: string) => v.split(".").map(Number).reduce((a, n) => a * 1000 + n, 0);
assert.deepEqual([...versions].sort((a, b) => key(b) - key(a)), versions, "newest first");
for (const n of RELEASE_NOTES) assert.ok(n.items.length > 0 && n.items.every((i) => i.trim()), `${n.version} has notes`);

// The version being shipped must have its entry, so the update banner never shows an empty "What's new"
for (const file of [".env.development", ".env.production", ".env.demo"]) {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  const v = /NEXT_PUBLIC_APP_VERSION=(\S+)/.exec(text)?.[1] ?? "";
  assert.ok(notesFor(v), `${file} is at ${v} but release-notes.ts has no entry for it`);
}
console.log("release-notes tests passed");
