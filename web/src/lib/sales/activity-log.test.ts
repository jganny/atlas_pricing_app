import assert from "node:assert/strict";
import { activityDay, formatDay, sortActivities, todayISO, visitProblem } from "./activity-log";
import type { LeadActivity } from "@/lib/types";

const act = (o: Partial<LeadActivity>): LeadActivity => ({ id: "a", leadId: "l", type: "meeting", body: "x", createdAt: "2026-10-19T10:00:00.000Z", ...o });

assert.equal(todayISO(new Date(2026, 9, 5, 23, 59)), "2026-10-05", "uses the local day, not UTC");
assert.equal(activityDay(act({ activityDate: "2026-10-17" })), "2026-10-17");
assert.equal(activityDay(act({})), "2026-10-19", "older entries fall back to when they were logged");

const sorted = sortActivities([
  act({ id: "old", activityDate: "2026-10-01" }),
  act({ id: "new", activityDate: "2026-10-17" }),
  act({ id: "legacy", createdAt: "2026-10-10T08:00:00.000Z" }),
]);
assert.deepEqual(sorted.map((a) => a.id), ["new", "legacy", "old"], "a back-dated visit sorts by its visit date");

const ok = { body: "Met the buyer", activityDate: "2026-10-17", nextStep: "", followUpDate: "" };
assert.equal(visitProblem(ok, "2026-10-19"), null);
assert.match(visitProblem({ ...ok, body: "" }, "2026-10-19") ?? "", /discussed/);
assert.equal(visitProblem({ ...ok, body: "", nextStep: "Send rate" }, "2026-10-19"), null, "a next step alone is enough");
assert.match(visitProblem({ ...ok, activityDate: "2026-10-25" }, "2026-10-19") ?? "", /future/);
assert.match(visitProblem({ ...ok, activityDate: "" }, "2026-10-19") ?? "", /date/);
assert.match(visitProblem({ ...ok, followUpDate: "2026-10-10" }, "2026-10-19") ?? "", /before the visit/);
assert.equal(formatDay("2026-10-17"), "17 Oct 2026");
console.log("activity-log tests passed");
