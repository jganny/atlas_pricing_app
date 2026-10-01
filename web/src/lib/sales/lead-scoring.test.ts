import assert from "node:assert/strict";
import { computeLeadScore } from "./lead-scoring";
import type { SalesLead } from "../types";

const NOW = Date.parse("2026-09-18T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function lead(partial: Partial<SalesLead>): SalesLead {
  return { id: "x", company: "Acme", status: "new", ...partial };
}
const labels = (l: SalesLead) => computeLeadScore(l, NOW).factors.map((f) => f.label);

// closed leads are fixed
assert.equal(computeLeadScore(lead({ status: "won" }), NOW).total, 100);
assert.equal(computeLeadScore(lead({ status: "lost" }), NOW).total, 0);

// bare lead scores nothing
assert.equal(computeLeadScore(lead({}), NOW).total, 0);

// each factor fires independently
assert.ok(labels(lead({ email: "a@b.c" })).includes("Contact details on file"));
assert.equal(computeLeadScore(lead({ email: "a@b.c", contactName: "Ann" }), NOW).total, 15);
assert.equal(computeLeadScore(lead({ dealValue: 2_000_000 }), NOW).total, 20);
assert.equal(computeLeadScore(lead({ dealValue: 300_000 }), NOW).total, 14);
assert.equal(computeLeadScore(lead({ dealValue: 60_000 }), NOW).total, 8);
assert.equal(computeLeadScore(lead({ dealValue: 10 }), NOW).total, 3);
assert.equal(computeLeadScore(lead({ status: "quoted" }), NOW).total, 24);
assert.equal(computeLeadScore(lead({ updatedAt: new Date(NOW - 2 * DAY).toISOString() }), NOW).total, 15);
assert.equal(computeLeadScore(lead({ updatedAt: new Date(NOW - 20 * DAY).toISOString() }), NOW).total, 8);
assert.ok(labels(lead({ updatedAt: new Date(NOW - 90 * DAY).toISOString() })).includes("No activity for 60+ days"));
assert.ok(labels(lead({ nextDueDate: "2026-09-01" })).includes("Follow-up overdue"));
assert.ok(labels(lead({ nextDueDate: "2026-12-01" })).includes("Follow-up scheduled"));
assert.equal(computeLeadScore(lead({ quoteIds: ["q1"] }), NOW).total, 10);
assert.equal(computeLeadScore(lead({ source: "Referral" }), NOW).total, 10);
assert.equal(computeLeadScore(lead({ source: "Phone" }), NOW).total, 5);
assert.equal(computeLeadScore(lead({ accountId: "acc1" }), NOW).total, 5);

// clamped to 0-100 both ways
const maxed = lead({
  status: "quoted",
  email: "a@b.c",
  contactName: "Ann",
  dealValue: 5_000_000,
  updatedAt: new Date(NOW - DAY).toISOString(),
  nextDueDate: "2027-01-01",
  quoteIds: ["q1"],
  source: "Referral",
  accountId: "acc1",
});
assert.equal(computeLeadScore(maxed, NOW).total, 100);
const floored = lead({ updatedAt: new Date(NOW - 200 * DAY).toISOString(), nextDueDate: "2026-01-01" });
assert.equal(computeLeadScore(floored, NOW).total, 0);

console.log("lead-scoring.test.ts: all assertions passed");
