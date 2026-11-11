import assert from "node:assert/strict";
import type { InboxEnquiry } from "../types";
import { isWaiting, tabTitle, workBarState } from "./work-bar";

const NOW = Date.UTC(2026, 10, 11, 5, 30); // 11:00 India
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const mk = (id: string, over: Partial<InboxEnquiry>): InboxEnquiry =>
  ({ id, mailbox: "pricing", mailboxEmail: "p@x", from: "Omar K <o@example.ae>", subject: "Sea JNPT to Jebel Ali", receivedAt: ago(3), bodyPreview: "", body: "", mode: "sea", confidence: 90, assignedUsers: [], status: "new", tag: "new_enquiry", ...over }) as InboxEnquiry;

assert.equal(workBarState([], NOW), null, "nothing waiting: no bar");
assert.equal(workBarState([mk("a", { status: "applied" }), mk("b", { workingBy: { username: "x", name: "X", at: NOW } }), mk("c", { repliedAt: NOW })], NOW), null, "quoted, being worked on and answered ones do not wait");
assert.equal(isWaiting(mk("d", { tag: "follow_up" }), NOW), false, "a follow-up is not a new enquiry");
assert.equal(isWaiting(mk("e", { receivedAt: ago(3 * 24 * 60) }), NOW), false, "days old: in the list, not on the bar");
assert.equal(isWaiting(mk("f", { tag: "escalation" }), NOW), true, "a problem on a shipment waits too");

const calm = workBarState([mk("a", {})], NOW)!;
assert.equal(calm.tone, "amber");
assert.match(calm.headline, /^Next: Omar K, Sea JNPT/);
assert.match(calm.detail, /nobody has opened it for 3 minutes/);
assert.equal(calm.count, 1);

const late = workBarState([mk("a", { receivedAt: ago(22) }), mk("b", { receivedAt: ago(2) })], NOW)!;
assert.equal(late.tone, "red", "20 minutes without being opened turns it red");
assert.equal(late.id, "a");
assert.match(late.detail, /1 more waiting/);

assert.match(workBarState([mk("a", { receivedAt: ago(0) })], NOW)!.detail, /just arrived/);
assert.equal(tabTitle("Atlas Pricing", 2), "(2) Atlas Pricing");
assert.equal(tabTitle("Atlas Pricing", 0), "Atlas Pricing");
console.log("work-bar tests passed");
