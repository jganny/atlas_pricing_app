import assert from "node:assert/strict";
import type { InboxEnquiry } from "../types";
import { listView, senderDisplay, viewCounts } from "./inbox-views";

const NOW = Date.UTC(2026, 11 - 1, 11, 8, 35); // 14:05 India
const iso = (ms: number) => new Date(ms).toISOString();
const mk = (id: string, over: Partial<InboxEnquiry>): InboxEnquiry =>
  ({ id, mailbox: "pricing", mailboxEmail: "pricing@x", from: "A <a@example.com>", subject: "Rates", receivedAt: iso(NOW - 60_000), bodyPreview: "", body: "", mode: "air", confidence: 90, assignedUsers: [], status: "new", ...over }) as InboxEnquiry;

const tokyo = mk("tokyo", { from: "T <t@example.co.jp>", mode: "air" }); // closes 09:00 UTC, 25 min left
const dubai = mk("dubai", { from: "O <o@example.ae>", subject: "By 3 pm IST please", mode: "sea" }); // 09:30 UTC
const delhi = mk("delhi", { from: "C <c@example.in>", mode: "air" }); // 12:30 UTC
const late = mk("late", { from: "L <l@example.in>", receivedAt: iso(NOW - 6 * 3_600_000), subject: "Quote by 12 pm IST", mode: "sea" }); // 06:30 UTC: past
const sales = mk("sales", { mailbox: "pricingsales", from: "S <s@example.in>" });
const done = mk("done", { status: "applied" });
const followUp = mk("fu", { tag: "follow_up", from: "F <f@example.in>" });
const rows = [delhi, dubai, tokyo, late, sales, done, followUp];

// Everything open, soonest reply-by first: the late one, Tokyo, then Dubai's client deadline, then the rest.
const all = listView(rows, "all", "shashank", NOW).map((r) => r.id);
assert.deepEqual(all.slice(0, 3), ["late", "tokyo", "dubai"]);
assert.ok(!all.includes("done"), "a quoted enquiry has left the list");

// Folders are filters.
assert.deepEqual(listView(rows, "past", "shashank", NOW).map((r) => r.id), ["late"]);
assert.deepEqual(listView(rows, "due", "shashank", NOW).map((r) => r.id), ["tokyo", "dubai"], "within the hour: Tokyo (25 min) and Dubai (55 min)");
assert.deepEqual(listView(rows, "sea", "shashank", NOW).map((r) => r.id), ["late", "dubai"]);
assert.deepEqual(listView(rows, "mb:pricingsales", "shashank", NOW).map((r) => r.id), ["sales"]);
assert.deepEqual(listView(rows, "followup", "shashank", NOW).map((r) => r.id), ["fu"]);

// A desk opened on an enquiry keeps it in the list (as being quoted) until the quote is saved and it leaves.
assert.ok(listView([mk("q", { status: "applied", workingBy: { username: "shaheer", name: "Shaheer", at: NOW - 1000 } })], "all", "shashank", NOW).length === 1);
assert.equal(listView([mk("old", { status: "applied" })], "all", "shashank", NOW).length, 0, "quoted long ago, no mark: gone");

// Who is quoting.
const w = { username: "shaheer", name: "Shaheer", at: NOW - 600_000 };
const withMark = rows.map((r) => (r.id === "dubai" ? { ...r, workingBy: w } : r));
assert.deepEqual(listView(withMark, "others", "shashank", NOW).map((r) => r.id), ["dubai"]);
assert.deepEqual(listView(withMark, "mine", "shaheer", NOW).map((r) => r.id), ["dubai"]);
assert.deepEqual(listView(withMark, "mine", "shashank", NOW).map((r) => r.id), []);

const c = viewCounts(rows, "shashank", NOW);
assert.equal(c.all, 6);
assert.equal(c.past, 1);
assert.equal(c.due, 2);
assert.equal(c.air + c.sea, 6 - 0, "every open enquiry is air or sea here");

// The customer is the sender's name, never the whole email address.
assert.equal(senderDisplay("Takeshi Yamada <t.yamada@example.co.jp>"), "Takeshi Yamada");
assert.equal(senderDisplay('"Omar K" <o@example.ae>'), "Omar K");
assert.equal(senderDisplay("<buyer@acmeexports.com>"), "Acmeexports");
assert.equal(senderDisplay("ravi.kumar@gmail.com"), "Ravi Kumar");
assert.equal(senderDisplay("sales@maersk.co.uk"), "Maersk");
assert.equal(senderDisplay(""), "Unknown sender");

console.log("inbox-views tests passed");
