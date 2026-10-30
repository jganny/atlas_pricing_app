import assert from "node:assert/strict";
import type { EnquiryRecord } from "@/lib/types";
import { monthTotals, secondsLabel, sortAttention, teamPerformance, type AttentionItem } from "./summary";

const now = new Date(2026, 9, 30, 12);
const enq = (over: Partial<EnquiryRecord>): EnquiryRecord => ({
  id: String(Math.random()), ref: "R", customer: "C", mode: "air", origin: "BLR", destination: "DXB", status: "quoted",
  slaHoursOpen: 0, assignee: "", creator: "shashank", createdAt: new Date(2026, 9, 10).toISOString(), ...over,
});
const rows = [
  enq({ status: "won", quoteSeconds: 300 }), enq({ quoteSeconds: 420 }), enq({}),
  enq({ creator: "kavya", status: "won" }), enq({ creator: "kavya", status: "lost" }),
  enq({ createdAt: new Date(2026, 8, 10).toISOString() }),          // last month
  enq({ status: "cancelled" }),                                       // cancelled
];

const team = teamPerformance(rows, now);
assert.deepEqual(team.map((t) => t.quoted), [3, 2], "this month only, cancelled left out, biggest first");
assert.equal(team[0].won, 1);
assert.equal(team[0].wonPct, 33);
assert.equal(team[0].avgSeconds, 360);
assert.equal(team[1].wonPct, 50);
assert.equal(team[1].avgSeconds, null);

const all = monthTotals(rows, "someone", true, now);
assert.equal(all.quoted, 5);
assert.equal(all.won, 2);
assert.equal(all.wonPct, 40);
const mine = monthTotals(rows, "shashank", false, now);
assert.equal(mine.quoted, 3, "a desk sees only its own quotes");
assert.equal(monthTotals(rows, "stranger", false, now).quoted, 0);
assert.equal(monthTotals([], "x", true, now).wonPct, 0, "no quotes means 0%, not NaN");

assert.equal(secondsLabel(null), "—");
assert.equal(secondsLabel(45), "45 sec");
assert.equal(secondsLabel(360), "6 min");

const item = (id: string, tone: AttentionItem["tone"], at: number): AttentionItem => ({ id, kind: "hub", title: id, sub: "", tag: "", tone, href: "/", at });
assert.deepEqual(sortAttention([item("n1", "new", 1), item("l2", "late", 5), item("l1", "late", 2), item("w", "warn", 0)]).map((i) => i.id), ["l1", "l2", "w", "n1"]);
assert.equal(sortAttention(Array.from({ length: 10 }, (_, i) => item(String(i), "new", i)), 4).length, 4);
console.log("home summary tests passed");
