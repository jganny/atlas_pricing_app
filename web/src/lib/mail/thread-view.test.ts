import assert from "node:assert/strict";
import { isOverdueVendor, linkLabel, linkedCount, memberTitle, vendorSummary, waitingText, type ThreadMember, type ThreadView } from "./thread-view";

const m = (over: Partial<ThreadMember>): ThreadMember => ({ kind: "card", id: "x", role: "reply", at: 0, who: "Prashant", email: "p@x.in", subject: "RE: x", attachments: 0, by: "headers", check: false, reason: "", ...over });

assert.equal(memberTitle(m({ role: "enquiry" })), "Enquiry received");
assert.equal(memberTitle(m({ role: "reply" })), "Reply from Prashant");
assert.equal(memberTitle(m({ role: "sent", to: [{ email: "a@x.in", name: "Air Logistics" }] })), "Sent to Air Logistics");
assert.equal(memberTitle(m({ role: "sent", to: [{ email: "a@x.in", name: "" }, { email: "b@x.in", name: "" }, { email: "c@x.in", name: "" }] })), "Sent to a@x.in and 2 more");
assert.equal(memberTitle(m({ role: "sent", to: [] })), "Sent on from Outlook");

assert.equal(vendorSummary([]), "");
assert.equal(vendorSummary([{ email: "a", name: "a", replied: true }]), "The vendor has replied");
assert.equal(vendorSummary([{ email: "a", name: "a", replied: true }, { email: "b", name: "b", replied: false }, { email: "c", name: "c", replied: false }]), "1 of 3 vendors have replied");
assert.equal(vendorSummary([{ email: "a", name: "a", replied: true }, { email: "b", name: "b", replied: true }]), "All 2 have replied");

const t: ThreadView = { rootId: "r", members: [m({ role: "enquiry" }), m({ role: "sent" }), m({ role: "reply" })], vendors: [] };
assert.equal(linkedCount(t), 2);
assert.equal(linkLabel("headers"), "Linked automatically");
assert.equal(linkLabel("manual"), "Linked by hand");
assert.equal(linkLabel("self"), "");
const T0 = Date.parse("2026-11-11T05:00:00Z");
assert.equal(waitingText(T0, T0 + 20 * 60_000), "waiting, asked just now");
assert.equal(waitingText(T0, T0 + 5 * 3_600_000), "waiting 5 h");
assert.equal(waitingText(T0, T0 + 50 * 3_600_000), "waiting 2 days");
assert.equal(waitingText(undefined, T0), "waiting");
assert.equal(isOverdueVendor({ email: "a", name: "a", replied: false, askedAt: T0 }, T0 + 25 * 3_600_000), true, "a day without an answer: time to call");
assert.equal(isOverdueVendor({ email: "a", name: "a", replied: true, askedAt: T0 }, T0 + 25 * 3_600_000), false);
console.log("thread-view tests passed");
