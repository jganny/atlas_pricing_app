import assert from "node:assert/strict";
import type { InboxEnquiry } from "../types";
import { teamBoard, waitedText } from "./team-board";

const NOW = Date.UTC(2026, 10, 11, 5, 30);
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const mk = (id: string, over: Partial<InboxEnquiry>): InboxEnquiry =>
  ({ id, mailbox: "pricing", mailboxEmail: "p@x", from: "Omar K <o@example.ae>", subject: "Sea", receivedAt: ago(5), bodyPreview: "", body: "", mode: "sea", confidence: 90, assignedUsers: [], status: "new", tag: "new_enquiry", ...over }) as InboxEnquiry;

const [p, s] = teamBoard(
  [
    mk("a", { receivedAt: ago(25) }),
    mk("b", { from: "Briseyda Cruz <b@x.mx>", receivedAt: ago(4) }),
    mk("c", { workingBy: { username: "shaheer", name: "Shaheer", at: NOW - 60_000 }, receivedAt: ago(40) }),
    mk("d", { mailbox: "pricingsales", receivedAt: ago(12) }),
    mk("e", { status: "applied" }), // quoted: gone
    mk("f", { tag: "follow_up" }), // a vendor reply is not an enquiry waiting
  ],
  NOW,
);
assert.equal(p.label, "pricing@");
assert.equal(p.open, 3, "three enquiries open on pricing@");
assert.equal(p.waiting, 2, "two of them nobody has opened");
assert.equal(p.quoting, 1);
assert.equal(p.lines[0].id, "c", "longest waiting first");
assert.equal(p.lines.find((l) => l.id === "c")?.quoting, "Shaheer");
assert.equal(s.open, 1);
assert.equal(s.waiting, 1);
assert.equal(waitedText(0), "just arrived");
assert.equal(waitedText(25), "25 min");
assert.equal(waitedText(130), "2 h 10 min");
assert.equal(waitedText(3000), "2 d");
console.log("team-board tests passed");
