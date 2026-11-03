import assert from "node:assert/strict";
import type { ChatMessage, ChatTask } from "./types";
import {
  ACK_EMOJI, acknowledgement, approvalState, canDecide, deadlineLabel, deadlinePresets, dueSoonCount, findQuoteRefs, isOverdue,
  matchSlash, newTaskId, openTasks, parseSlashWithText, tasksToAnnounce,
} from "./work";

const msg = (o: Partial<ChatMessage>): ChatMessage => ({ id: "m", roomId: "r", senderLogin: "a", senderName: "A", text: "", createdAtMs: 1000, ...o });

// quote references
assert.deepEqual(findQuoteRefs("see AEPAY1026IN60278 and aepay1026in60278 and CRADV1026IN19953"), ["AEPAY1026IN60278", "CRADV1026IN19953"]);
assert.deepEqual(findQuoteRefs("nothing here, IN 2026"), []);
assert.equal(findQuoteRefs("AEAAA0126IN1 AEAAA0126IN2 AEAAA0126IN333 AEAAA0126IN444 AEAAA0126IN555").length, 3);

// approvals
const ask = msg({ id: "q1", senderLogin: "cathrina", approval: { id: "q1", approvers: ["ganny"] } });
assert.ok(canDecide(ask, "ganny"));
assert.ok(!canDecide(ask, "ramesh"), "only the named approver");
assert.ok(!canDecide(ask, "cathrina"), "the asker cannot approve their own request");
assert.ok(canDecide(msg({ id: "q2", senderLogin: "c", approval: { id: "q2", approvers: [] } }), "anyone"));
assert.deepEqual(approvalState(ask, []), { status: "pending" });
const no = msg({ id: "d0", senderLogin: "ramesh", createdAtMs: 1500, decision: { forId: "q1", outcome: "approved" } });
const yes = msg({ id: "d1", senderLogin: "ganny", createdAtMs: 2000, decision: { forId: "q1", outcome: "approved" } });
const later = msg({ id: "d2", senderLogin: "ganny", createdAtMs: 3000, decision: { forId: "q1", outcome: "declined", note: "changed my mind" } });
assert.deepEqual(approvalState(ask, [no, yes, later]), { status: "approved", by: "ganny", at: 2000, note: undefined }, "earliest valid answer wins; others ignored");
assert.equal(approvalState(ask, [msg({ id: "x", senderLogin: "ganny", createdAtMs: 2000, deleted: true, decision: { forId: "q1", outcome: "approved" } })]).status, "pending");

// reply-by
const r = msg({ id: "r1", senderLogin: "a", createdAtMs: 1000, replyBy: 5000, reactions: { [ACK_EMOJI]: ["b"] } });
const ack = acknowledgement(r, [r, msg({ id: "x", senderLogin: "c", createdAtMs: 2000 })], ["a", "b", "c", "d"]);
assert.deepEqual(ack.asked, ["b", "c", "d"]);
assert.deepEqual(ack.done, ["b", "c"]);
assert.deepEqual(ack.waiting, ["d"]);
assert.deepEqual(acknowledgement(msg({ senderLogin: "a", mentions: ["d"] }), [], ["a", "b", "d"]).asked, ["d"]);
assert.ok(isOverdue(1000, 2000));
assert.ok(!isOverdue(undefined, 2000));

// deadline text and presets (fixed local noon on a known day)
const noon = new Date(2026, 10, 3, 12, 0, 0).getTime();
assert.equal(deadlineLabel(new Date(2026, 10, 3, 16, 0).getTime(), noon), "4:00 pm");
assert.equal(deadlineLabel(new Date(2026, 10, 4, 10, 0).getTime(), noon), "tomorrow 10:00 am");
const presets = deadlinePresets(noon);
assert.deepEqual(presets.map((p) => p.label), ["In 1 hour", "Today 4 pm", "Tomorrow 10 am"]);
const late = new Date(2026, 10, 3, 17, 30).getTime();
assert.ok(!deadlinePresets(late).some((p) => p.label === "Today 4 pm"), "no 4 pm preset once it has passed");

// tasks
const t = (id: string, o: Partial<ChatTask>): ChatTask => ({ id, text: id, createdAt: 1, ...o });
const tasks = { a: t("a", { dueMs: noon + 1000 }), b: t("b", { dueMs: noon - 1000 }), c: t("c", {}), d: t("d", { done: true }), e: t("e", { removed: true }) };
assert.deepEqual(openTasks(tasks).map((x) => x.id), ["b", "a", "c"]);
assert.equal(dueSoonCount(tasks, noon), 2);
assert.deepEqual(tasksToAnnounce(tasks, noon, new Set()).map((x) => x.id), ["b"]);
assert.deepEqual(tasksToAnnounce(tasks, noon, new Set(["b"])), []);
assert.notEqual(newTaskId(), newTaskId());

// slash actions
assert.deepEqual(matchSlash("/")?.map((c) => c.key), ["quote", "approve", "replyby", "task", "remind"]);
assert.deepEqual(matchSlash("/ap")?.map((c) => c.key), ["approve"]);
assert.equal(matchSlash("hello"), null);
assert.equal(matchSlash("/task buy"), null, "once there are words, it is no longer the menu");
assert.deepEqual(parseSlashWithText("/task call the client"), { key: "task", rest: "call the client" });
assert.equal(parseSlashWithText("/task"), null);

console.log("chat work features: refs, approvals, reply-by, tasks, slash");
