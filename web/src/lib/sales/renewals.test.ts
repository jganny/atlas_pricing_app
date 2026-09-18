import assert from "node:assert/strict";
import {
  RENEWAL_LOOKAHEAD_DAYS,
  STALE_ACCOUNT_DAYS,
  accountActivity,
  accountsNeedingAttention,
  contractRenewalStatus,
  isAccountQuiet,
} from "./renewals";
import type { Account, EnquiryRecord, SalesLead } from "../types";

const NOW = Date.parse("2026-09-19T00:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const acct = (p: Partial<Account>): Account => ({ id: "a1", name: "Acme Ltd", owner: "ravi", accountType: "customer", createdAt: iso(400), ...p });
const enq = (p: Partial<EnquiryRecord>): EnquiryRecord => ({
  id: "e", ref: "R", customer: "Acme Ltd", mode: "air", origin: "A", destination: "B", status: "quoted",
  slaHoursOpen: 0, assignee: "", creator: "", createdAt: iso(10), ...p,
});
const lead = (p: Partial<SalesLead>): SalesLead => ({ id: "l", company: "Acme Ltd", status: "new", ...p });

// renewal window boundaries
const inDays = (n: number) => new Date(NOW + n * DAY).toISOString().slice(0, 10);
assert.equal(contractRenewalStatus({ contractRenewalDate: inDays(RENEWAL_LOOKAHEAD_DAYS) }, NOW).reason, "renewal-soon");
assert.equal(contractRenewalStatus({ contractRenewalDate: inDays(RENEWAL_LOOKAHEAD_DAYS + 1) }, NOW).reason, null);
assert.equal(contractRenewalStatus({ contractRenewalDate: inDays(-3) }, NOW).reason, "renewal-overdue");
assert.equal(contractRenewalStatus({ contractRenewalDate: inDays(-3) }, NOW).daysUntil! < 0, true);
assert.equal(contractRenewalStatus({}, NOW).reason, null);

// activity: exact-name match only, won tracked separately
const act = accountActivity(acct({}), [], [
  enq({ id: "1", createdAt: iso(50), status: "won" }),
  enq({ id: "2", createdAt: iso(5) }),
  enq({ id: "3", customer: "Acme Ltd Holdings", createdAt: iso(1) }), // different company — ignored
  enq({ id: "4", customer: "  acme   LTD ", createdAt: iso(20) }), // same company, messy spelling
]);
assert.equal(Math.round((NOW - act.lastQuoteAt!) / DAY), 5);
assert.equal(Math.round((NOW - act.lastWonAt!) / DAY), 50);
// lead wins linked by accountId count
const viaLead = accountActivity(acct({}), [lead({ accountId: "a1", status: "won", wonAt: iso(7) })], []);
assert.equal(Math.round((NOW - viaLead.lastWonAt!) / DAY), 7);

// quiet: customers only, threshold, uses createdAt when no activity
const none = { lastWonAt: null, lastQuoteAt: null, lastActivityAt: null };
assert.equal(isAccountQuiet(acct({ accountType: "prospect" }), none, NOW).quiet, false);
assert.equal(isAccountQuiet(acct({ accountType: "churned" }), none, NOW).quiet, false);
assert.equal(isAccountQuiet(acct({ createdAt: iso(400) }), none, NOW).quiet, true);
assert.equal(isAccountQuiet(acct({ createdAt: iso(5) }), none, NOW).quiet, false); // brand-new, not flagged
const at = (d: number) => ({ lastWonAt: null, lastQuoteAt: NOW - d * DAY, lastActivityAt: NOW - d * DAY });
assert.equal(isAccountQuiet(acct({}), at(STALE_ACCOUNT_DAYS), NOW).quiet, false);
assert.equal(isAccountQuiet(acct({}), at(STALE_ACCOUNT_DAYS + 1), NOW).quiet, true);

// attention list: ordering, churned skipped, open-lead flag
const accounts = [
  acct({ id: "quiet", name: "Quiet Co" }),
  acct({ id: "soon", name: "Soon Co", contractRenewalDate: inDays(20) }),
  acct({ id: "overdue", name: "Overdue Co", contractRenewalDate: inDays(-5) }),
  acct({ id: "fine", name: "Fine Co" }),
  acct({ id: "churn", name: "Churn Co", accountType: "churned", contractRenewalDate: inDays(1) }),
];
const enquiries = [enq({ id: "f", customer: "Fine Co", createdAt: iso(3) }), enq({ id: "s", customer: "Soon Co", createdAt: iso(3) }), enq({ id: "o", customer: "Overdue Co", createdAt: iso(3) })];
const list = accountsNeedingAttention(accounts, [lead({ company: "Soon Co", status: "quoted" })], enquiries, NOW);
assert.deepEqual(list.map((i) => i.account.id), ["overdue", "soon", "quiet"]);
assert.deepEqual(list[0]!.reasons, ["renewal-overdue"]);
assert.equal(list.find((i) => i.account.id === "soon")!.hasOpenLead, true);
assert.equal(list.find((i) => i.account.id === "overdue")!.hasOpenLead, false);
assert.equal(list.some((i) => i.account.id === "fine" || i.account.id === "churn"), false);

console.log("renewals.test.ts: all assertions passed");
