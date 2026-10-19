import assert from "node:assert/strict";
import { DELETE_WINDOW_MS, canDeleteActivity, deleteMinutesLeft, handoversFrom, isHandover, lastVisitDay, unseenHandovers, visitCandidates } from "./visit-flow";
import type { Account, LeadActivity, SalesLead } from "@/lib/types";

const t0 = Date.parse("2026-10-19T10:00:00.000Z");
const entry = (o: Partial<LeadActivity> = {}): LeadActivity => ({ id: "a", leadId: "l", type: "meeting", body: "x", createdBy: "sunil", createdAt: new Date(t0).toISOString(), ...o });

// Delete: own entry for 2 hours, admin any time, nobody else.
assert.equal(canDeleteActivity(entry(), "sunil", false, t0 + DELETE_WINDOW_MS - 1000), true);
assert.equal(canDeleteActivity(entry(), "Sunil", false, t0 + 60_000), true, "case does not matter");
assert.equal(canDeleteActivity(entry(), "sunil", false, t0 + DELETE_WINDOW_MS + 1000), false, "after 2 hours");
assert.equal(canDeleteActivity(entry(), "ramesh", false, t0 + 60_000), false, "someone else's entry");
assert.equal(canDeleteActivity(entry(), "ganny", true, t0 + 30 * DELETE_WINDOW_MS), true, "admin always");
assert.equal(canDeleteActivity(entry(), undefined, false, t0), false);
assert.equal(canDeleteActivity(entry({ createdAt: "garbage" }), "sunil", false, t0), false);
assert.equal(deleteMinutesLeft(entry(), t0 + 90 * 60_000), 30);
assert.equal(deleteMinutesLeft(entry(), t0 + 5 * 3600_000), 0);

// Handovers
assert.equal(isHandover("sunil", "ramesh"), true);
assert.equal(isHandover("sunil", "Sunil"), false);
assert.equal(isHandover("sunil", ""), false);
const rows = [
  { id: "1", atIso: "2026-10-18T10:00:00Z", actor: "linson", action: "lead.handover", entityLabel: "Gulf Imports", changes: { owner: { from: "linson", to: "goutham" } } },
  { id: "2", atIso: "2026-10-19T10:00:00Z", actor: "sunil", action: "lead.handover", entityLabel: "Pearl Cargo", changes: { owner: { from: "sunil", to: "ramesh" } } },
  { id: "3", atIso: "2026-10-19T11:00:00Z", actor: "sunil", action: "lead.create", entityLabel: "Other" },
];
const h = handoversFrom(rows);
assert.deepEqual(h.map((e) => `${e.from}>${e.to}:${e.company}`), ["sunil>ramesh:Pearl Cargo", "linson>goutham:Gulf Imports"]);
assert.equal(unseenHandovers(h, "2026-10-18T12:00:00Z"), 1);
assert.equal(unseenHandovers(h, ""), 2);

// New visit picker: own leads first, accounts only when they have no lead, nothing under 2 letters.
const lead = (o: Partial<SalesLead>): SalesLead => ({ id: "l1", company: "Zenith Electronics", status: "contacted", ...o });
const acct = (o: Partial<Account>): Account => ({ id: "a1", name: "Zenith Electronics", owner: "sunil", ...o });
assert.deepEqual(visitCandidates([lead({})], [], "z"), []);
const c = visitCandidates([lead({}), lead({ id: "l2", company: "Pearl Cargo" })], [acct({}), acct({ id: "a2", name: "Zenith Textiles", accountType: "customer" })], "zen");
assert.deepEqual(c.map((x) => `${x.kind}:${x.company}`), ["lead:Zenith Electronics", "account:Zenith Textiles"], "account with the same name as a lead is not listed twice");
assert.equal(visitCandidates([lead({ accountId: "a9" })], [acct({ id: "a9", name: "Zenith Group" })], "zenith").length, 1, "a linked account is not listed twice");

assert.equal(lastVisitDay([entry({ activityDate: "2026-10-01" }), entry({ activityDate: "2026-10-17" }), entry({ type: "call", activityDate: "2026-10-18" })]), "2026-10-17");
assert.equal(lastVisitDay([]), null);
console.log("visit-flow tests passed");
