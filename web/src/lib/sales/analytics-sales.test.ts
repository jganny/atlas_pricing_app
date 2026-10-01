import assert from "node:assert/strict";
import { averageDealSize, lossReasonBreakdown, winRate } from "./win-loss";
import { averageCycleTimeDays, cycleTimeDays } from "./cycle-time";
import { repLeaderboard } from "./rep-leaderboard";
import type { SalesLead } from "../types";

const lead = (p: Partial<SalesLead>): SalesLead => ({ id: "x", company: "Acme", status: "new", ...p });

// win rate: null when nothing closed, open leads ignored
assert.equal(winRate([lead({}), lead({ status: "quoted" })]), null);
assert.equal(winRate([lead({ status: "won" }), lead({ status: "lost" }), lead({ status: "lost" }), lead({})]), 1 / 3);

// average deal size: valued leads of that outcome only; null when none (no divide-by-zero)
assert.equal(averageDealSize([]), null);
assert.equal(averageDealSize([lead({ status: "won", dealValue: 100 }), lead({ status: "won", dealValue: 300 }), lead({ status: "won" })]), 200);
assert.equal(averageDealSize([lead({ status: "lost", dealValue: 50 })], "lost"), 50);

// loss reasons
const reasons = lossReasonBreakdown([
  lead({ status: "lost", lossReasonCode: "price", dealValue: 100 }),
  lead({ status: "lost", lossReasonCode: "price", dealValue: 50 }),
  lead({ status: "lost" }),
  lead({ status: "won", lossReasonCode: "price" }),
]);
assert.deepEqual(reasons.map((r) => [r.code, r.count, r.value]), [["price", 2, 150], ["unspecified", 1, 0]]);
assert.equal(reasons[1]!.label, "No reason recorded");

// cycle time
const created = "2026-09-01T00:00:00Z";
assert.equal(cycleTimeDays(lead({ status: "won", createdAt: created, wonAt: "2026-09-11T00:00:00Z" })), 10);
assert.equal(cycleTimeDays(lead({ status: "lost", createdAt: created, lostAt: "2026-09-04T00:00:00Z" })), 3);
assert.equal(cycleTimeDays(lead({ status: "quoted", createdAt: created })), null); // open
assert.equal(cycleTimeDays(lead({ status: "won", createdAt: created })), null); // no wonAt (legacy-closed)
assert.equal(cycleTimeDays(lead({ status: "won", createdAt: "2026-09-11T00:00:00Z", wonAt: created })), null); // negative
assert.equal(
  averageCycleTimeDays([
    lead({ status: "won", createdAt: created, wonAt: "2026-09-11T00:00:00Z" }),
    lead({ status: "won", createdAt: created, wonAt: "2026-09-21T00:00:00Z" }),
    lead({ status: "won", createdAt: created }),
  ], "won"),
  15,
);
assert.equal(averageCycleTimeDays([]), null);

// leaderboard: groups case-insensitively, revenue = won value only, unassigned bucket
const board = repLeaderboard([
  lead({ owner: "Ravi", status: "won", dealValue: 500 }),
  lead({ owner: "ravi", status: "won", dealValue: 100 }),
  lead({ owner: "ravi", status: "lost", dealValue: 900 }),
  lead({ owner: "asha", status: "won", dealValue: 700 }),
  lead({ status: "quoted", dealValue: 5000 }),
]);
assert.deepEqual(board.map((b) => b.owner), ["asha", "ravi", "unassigned"]); // by won revenue
const ravi = board.find((b) => b.owner === "ravi")!;
assert.equal(ravi.revenue, 600);
assert.equal(ravi.winRate, 2 / 3);
assert.equal(ravi.avgDealSize, 300);
const un = board.find((b) => b.owner === "unassigned")!;
assert.equal(un.winRate, null);
assert.equal(un.open, 1);

console.log("analytics-sales.test.ts: all assertions passed");
