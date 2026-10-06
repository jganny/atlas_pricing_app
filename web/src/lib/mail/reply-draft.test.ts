import assert from "node:assert/strict";
import {
  basicReplyDraft,
  mailtoHref,
  replySubject,
  senderEmail,
  senderFirstName,
  understandEnquiry,
} from "./reply-draft";
import type { InboxEnquiry } from "../types";

function item(partial: Omit<Partial<InboxEnquiry>, "parsed"> & { parsed?: Partial<InboxEnquiry["parsed"]> }): InboxEnquiry {
  const { parsed, ...rest } = partial;
  return {
    id: "i1",
    mailbox: "pricing",
    mailboxEmail: "pricing@example.com",
    from: "Priya N <priya.n@bosch.example>",
    subject: "Rates request — Bangalore to Hamburg",
    receivedAt: "2026-10-06T09:42:00Z",
    bodyPreview: "Please share rates for 2 x 40HC",
    body: "",
    mode: "sea",
    confidence: 80,
    assignedUsers: [],
    status: "new",
    parsed: {
      customer: "Bosch India",
      origin: "BLR",
      destination: "HAM",
      packages: [],
      containers: [{ type: "40'HC", qty: 2 }],
      confidence: 80,
      source: "test",
      ...parsed,
    },
    ...rest,
  } as InboxEnquiry;
}

// understood vs missing
const u = understandEnquiry(item({}), "sea");
assert.deepEqual(u.understood, ["BLR → HAM", "2 × 40'HC"]);
assert.deepEqual(u.missing, ["commodity", "Incoterm"]);

const complete = understandEnquiry(item({ parsed: { commodity: "Auto parts", incoterm: "FOB" } }), "sea");
assert.deepEqual(complete.missing, []);

const air = understandEnquiry(
  item({ parsed: { containers: [], packages: [{ qty: 4, gw: 100 }], grossWeight: 400 } }),
  "air",
);
assert.equal(air.understood[1], "4 packages, 400 kg");

const empty = understandEnquiry(item({ parsed: { origin: "", destination: "", containers: [], packages: [] } }), "sea");
assert.deepEqual(empty.missing, ["origin and destination", "container type and quantity", "commodity", "Incoterm"]);

// sender parsing
assert.equal(senderEmail("Priya N <priya.n@bosch.example>"), "priya.n@bosch.example");
assert.equal(senderEmail("buyer@local.example"), "buyer@local.example");
assert.equal(senderEmail("no address"), "");
assert.equal(senderFirstName("Priya N <priya.n@bosch.example>"), "Priya");
assert.equal(senderFirstName("priya.n@bosch.example"), "Priya");
assert.equal(senderFirstName(""), "");

assert.equal(replySubject("Quote please"), "Re: Quote please");
assert.equal(replySubject("RE: Quote please"), "RE: Quote please");
assert.equal(replySubject(""), "Re: your enquiry");

// template reply: asks for the missing items, never mentions a price
const draft = basicReplyDraft(item({}), "sea", "Pricing Team");
assert.equal(draft.subject, "Re: Rates request — Bangalore to Hamburg");
assert.ok(draft.body.startsWith("Hi Priya,"));
assert.ok(draft.body.includes("• commodity") && draft.body.includes("• Incoterm"));
assert.ok(draft.body.includes("BLR → HAM"));
assert.ok(!/\$|usd|price/i.test(draft.body));
assert.ok(draft.body.trim().endsWith("Pricing Team"));

const full = basicReplyDraft(item({ parsed: { commodity: "Auto parts", incoterm: "FOB" } }), "sea");
assert.ok(full.body.includes("will share them shortly"));
assert.ok(!full.body.includes("•"));

// mailto
const href = mailtoHref("priya.n@bosch.example", "Re: A & B", "Line1\nLine2");
assert.ok(href.startsWith("mailto:priya.n@bosch.example?subject=Re%3A%20A%20%26%20B&body=Line1%0ALine2"));

console.log("reply-draft.test.ts: all assertions passed");
