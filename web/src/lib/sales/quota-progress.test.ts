import assert from "node:assert/strict";
import {
  currentPeriod,
  periodLabel,
  periodOptions,
  periodRange,
  quotaProgress,
  shiftPeriod,
  targetOwnerMatches,
} from "./quota-progress";
import { canDeleteLead, canEditAccount, canEditLead, canManageSalesTargets } from "../auth/sales-access";
import type { SalesLead, SalesTarget, SalesTerritory } from "../types";

// periods
assert.equal(currentPeriod(new Date(2026, 8, 19).getTime()), "2026-Q3");
assert.equal(currentPeriod(new Date(2026, 0, 1).getTime()), "2026-Q1");
assert.equal(currentPeriod(new Date(2026, 11, 31).getTime()), "2026-Q4");
assert.equal(shiftPeriod("2026-Q4", 1), "2027-Q1");
assert.equal(shiftPeriod("2026-Q1", -1), "2025-Q4");
assert.equal(shiftPeriod("2026-Q2", 5), "2027-Q3");
assert.equal(periodLabel("2026-Q3"), "Jul – Sep 2026 (Q3)");
assert.equal(periodRange("bogus"), null);
assert.deepEqual(periodOptions(new Date(2026, 8, 19).getTime(), 1, 2), ["2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"]);
const q3 = periodRange("2026-Q3")!;
assert.equal(q3.start, new Date(2026, 6, 1).getTime());
assert.equal(q3.end, new Date(2026, 9, 1).getTime());

const lead = (p: Partial<SalesLead>): SalesLead => ({ id: "x", company: "Acme", status: "won", ...p });
const target = (p: Partial<SalesTarget>): SalesTarget => ({ id: "t", owner: "ravi", period: "2026-Q3", targetRevenue: 1000, ...p });

// owner matching
const terr: SalesTerritory[] = [{ id: "s", name: "South India", ownerUsernames: ["asha"] }];
assert.equal(targetOwnerMatches("ravi", lead({ owner: "Ravi" })), true);
assert.equal(targetOwnerMatches("ravi", lead({ owner: "asha" })), false);
assert.equal(targetOwnerMatches("team:all", lead({})), true);
assert.equal(targetOwnerMatches("team:South India", lead({ owner: "asha" }), terr), true); // member
assert.equal(targetOwnerMatches("team:South India", lead({ owner: "ravi", territory: "south india" }), terr), true); // tagged
assert.equal(targetOwnerMatches("team:South India", lead({ owner: "ravi" }), terr), false);
assert.equal(targetOwnerMatches("team:South India", lead({ owner: "" }), terr), false);

// progress: in-period wins by the right owner only
const inQ3 = "2026-08-10T00:00:00Z";
const leads = [
  lead({ owner: "ravi", dealValue: 400, wonAt: inQ3 }),
  lead({ owner: "ravi", dealValue: 300, wonAt: "2026-09-29T12:00:00Z" }),
  lead({ owner: "ravi", dealValue: 999, wonAt: "2026-06-30T00:00:00Z" }), // Q2
  lead({ owner: "ravi", dealValue: 999, wonAt: "2026-10-05T00:00:00Z" }), // Q4
  lead({ owner: "asha", dealValue: 500, wonAt: inQ3 }), // other rep
  lead({ owner: "ravi", dealValue: 700, status: "lost", wonAt: inQ3 }), // not won
  lead({ owner: "ravi", dealValue: 100, updatedAt: inQ3 }), // legacy-closed, falls back to updatedAt
];
const p = quotaProgress(target({ targetWinCount: 4 }), leads);
assert.equal(p.achieved, 800);
assert.equal(p.wins, 3);
assert.equal(p.revenuePct, 0.8);
assert.equal(p.winsPct, 0.75);
assert.equal(quotaProgress(target({ targetRevenue: 0 }), leads).revenuePct, null);
assert.equal(quotaProgress(target({}), leads).winsPct, null);
assert.equal(quotaProgress(target({ period: "nope" }), leads).achieved, 0);
assert.equal(quotaProgress(target({ owner: "team:all" }), leads).achieved, 1300);

// permissions
assert.equal(canEditLead("ganny", "ganny", { owner: "ravi" }), true); // admin
assert.equal(canEditLead("ravi", "sales", { owner: "Ravi" }), true); // own
assert.equal(canEditLead("ravi", "sales", { owner: "asha" }), false); // someone else's
assert.equal(canEditLead("ravi", "sales", { owner: "" }), true); // unowned legacy lead
assert.equal(canEditLead(undefined, "sales", { owner: "" }), false);
assert.equal(canDeleteLead("ravi", "sales"), false);
assert.equal(canDeleteLead("manager", "manager"), true);
assert.equal(canEditAccount("ravi", "sales", { owner: "ravi" }), true);
assert.equal(canEditAccount("ravi", "sales", { owner: "asha" }), false);
assert.equal(canEditAccount("admin", "sales", { owner: "asha" }), true);
assert.equal(canManageSalesTargets("ravi", "sales"), false);
assert.equal(canManageSalesTargets("ganny", "ganny"), true);

console.log("quota-progress.test.ts: all assertions passed");
