import assert from "node:assert/strict";
import type { DirectoryContact } from "../types";
import { describeAgencyPlan, normalizeAgentName, planAgencyImport, sameAgent } from "./agent-import";

// Names written differently are still the same company.
assert.equal(normalizeAgentName("ABC Logistics Co., Ltd."), normalizeAgentName("abc  logistics co ltd"));
assert.equal(normalizeAgentName("A.B.C. Logistics Limited"), normalizeAgentName("ABC LOGISTICS"));
assert.equal(normalizeAgentName("Sea & Air Cargo Pte Ltd"), normalizeAgentName("Sea and Air Cargo"));
assert.notEqual(normalizeAgentName("Global Freight"), normalizeAgentName("Global Forwarding"));
assert.equal(sameAgent({ name: "Acme Ltd", location: "Dubai, UAE" }, { name: "ACME Limited", location: "dubai" }), true);
assert.equal(sameAgent({ name: "Acme Ltd", location: "Dubai" }, { name: "Acme Ltd", location: "Singapore" }), false); // same name, different place
assert.equal(sameAgent({ name: "Acme Ltd", location: "Dubai", email: "a@acme.com" }, { name: "Acme", location: "Jebel Ali", email: "A@acme.com" }), true); // same email settles it
assert.equal(sameAgent({ name: "Acme" }, { name: "Acme", location: "Dubai" }), true); // an unknown place doesn't contradict

const ex = (id: string, name: string, over: Partial<DirectoryContact> = {}): DirectoryContact => ({
  id, name, category: "agency", location: "Dubai", updatedAt: "2026-01-01", ...over,
});
const row = (name: string, over: Partial<DirectoryContact> = {}): Partial<DirectoryContact> & { name: string } => ({ name, category: "agency", location: "Dubai", ...over });

// Last week's imported rows are replaced; repeats inside the file are kept once (the fuller row).
let plan = planAgencyImport(
  [ex("old1", "Acme Ltd", { importBatchId: "b1" }), ex("old2", "Beta Co", { importBatchId: "b1" })],
  [row("Acme Ltd"), row("ACME Limited", { email: "x@acme.com", phone: "1" }), row("Gamma")],
);
assert.deepEqual(plan.deleteIds.sort(), ["old1", "old2"]);
assert.equal(plan.incoming.length, 2);
assert.equal(plan.incoming.find((r) => normalizeAgentName(r.name) === "acme")?.email, "x@acme.com");
assert.deepEqual(plan.fileRepeats, ["Acme Ltd"]);
assert.equal(plan.previousImportRemoved, 2);

// A hand-added agent that the file also lists is replaced by the new row, in place; extra copies go.
plan = planAgencyImport(
  [ex("m1", "Delta Logistics", { updatedAt: "2026-02-01" }), ex("m2", "Delta Logistics Ltd", { updatedAt: "2026-03-01" }), ex("m3", "Delta Logistics LLC", { updatedAt: "2026-01-01", agreementUrl: "https://pdf" })],
  [row("Delta Logistics")],
);
assert.equal(plan.absorbIdByIndex[0], "m3"); // the copy that has an agreement attached is the one kept
assert.deepEqual(plan.deleteIds.sort(), ["m1", "m2"]);
assert.equal(plan.oldDuplicatesRemoved.length, 2);

// Hand-added agents the file doesn't mention stay — unless they repeat each other (newest kept).
plan = planAgencyImport(
  [ex("h1", "Solo Agent"), ex("h2", "Twin Agent", { updatedAt: "2026-01-01" }), ex("h3", "Twin Agent Ltd", { updatedAt: "2026-05-01" })],
  [row("Other")],
);
assert.deepEqual(plan.deleteIds, ["h2"]);
assert.equal(plan.manualKept, 2); // Solo Agent + the kept Twin
assert.equal(plan.incoming.length, 1);

// Same name in a different country is a different agent — both survive.
plan = planAgencyImport([ex("d", "Global Freight", { location: "Dubai" })], [row("Global Freight", { location: "Hamburg, Germany" })]);
assert.deepEqual(plan.deleteIds, []);
assert.deepEqual(plan.absorbIdByIndex, {});

// Contacts (non-agency rows) are never touched by an agent upload.
plan = planAgencyImport(
  [ex("v1", "Acme Ltd", { category: "vendor" }), ex("v2", "Acme Ltd", { category: "vendor" })],
  [row("Acme Ltd")],
);
assert.deepEqual(plan.deleteIds, []);

// The summary says what will happen, in plain words, and asks to continue.
const text = describeAgencyPlan(
  planAgencyImport([ex("o", "Acme Ltd", { importBatchId: "b" }), ex("m1", "Zed"), ex("m2", "Zed Co")], [row("Acme"), row("Acme Limited")]),
);
assert.equal(text.includes("This upload has 1 agents."), true);
assert.equal(text.includes("replaced"), true);
assert.equal(text.includes("Older duplicate entries"), true);
assert.equal(text.trim().endsWith("Continue?"), true);

console.log("agent-import.test.ts: all assertions passed");
