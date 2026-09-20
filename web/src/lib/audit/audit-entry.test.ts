import assert from "node:assert/strict";
import { clip, diffFields, summarizeChanges } from "./audit-entry";

const changes = diffFields(
  { company: "Acme", dealValue: 100, notes: "", tags: ["a"], same: "x" },
  { company: "Acme Ltd", dealValue: 100, notes: undefined, tags: ["a", "b"], same: "x" },
  ["company", "dealValue", "notes", "tags", "same", "missing"],
);
assert.deepEqual(Object.keys(changes).sort(), ["company", "tags"]); // empty == undefined, unchanged ignored
assert.deepEqual(changes.company, { from: "Acme", to: "Acme Ltd" });
assert.deepEqual(changes.tags, { from: "a", to: "a, b" });
assert.equal(summarizeChanges(changes), "company: Acme → Acme Ltd; tags: a → a, b");

// blank on one side shows a dash, never "undefined"
assert.equal(summarizeChanges(diffFields({}, { owner: "ravi" }, ["owner"])), "owner: — → ravi");

// oversized values and long summaries are bounded
const long = "x".repeat(500);
assert.equal(diffFields({ a: "" }, { a: long }, ["a"]).a!.to!.length, 200);
assert.ok(summarizeChanges(diffFields({}, { a: long, b: long, c: long }, ["a", "b", "c"])).length <= 300);
const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`f${i}`, String(i)]));
assert.equal(Object.keys(diffFields({}, many, Object.keys(many))).length, 20);

assert.equal(clip("  hi  "), "hi");
assert.equal(clip(undefined), "");
assert.equal(clip("y".repeat(400)).length, 300);

console.log("audit-entry.test.ts: all assertions passed");
