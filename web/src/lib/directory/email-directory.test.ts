import assert from "node:assert/strict";
import { contactsForCarrier, countByType, filterContacts, suggestRateSource, type EmailContact } from "./email-directory";

const mk = (over: Partial<EmailContact>): EmailContact => ({ id: "x", email: "a@b.com", name: "", domain: "b.com", type: "unknown", typeSource: "none", org: "", carrierCode: "", rateSource: "", mailboxes: [], count: 1, firstSeen: 1, lastSeen: 2, note: "", ...over });
const rows = [
  mk({ id: "1", email: "cargo@etihad.com", type: "airline", org: "Etihad Cargo", carrierCode: "EY", typeSource: "rules" }),
  mk({ id: "2", email: "rates@maersk.com", type: "liner", org: "Maersk", rateSource: "portal" }),
  mk({ id: "3", email: "ops@bluesea.com", name: "Bluesea Forwarding", type: "overseas-agent" }),
  mk({ id: "4", email: "x@zzz.com" }),
];

assert.equal(filterContacts(rows, { type: "airline" }).length, 1);
assert.equal(filterContacts(rows, { type: "all", text: "BLUESEA" }).length, 1, "search ignores case, and finds name and address");
assert.equal(filterContacts(rows, { text: "ey" }).length, 1, "carrier code");
assert.deepEqual(filterContacts(rows, {}).map((r) => r.id), ["1", "2", "3", "4"]);
const c = countByType(rows);
assert.deepEqual([c.all, c.airline, c.liner, c["overseas-agent"], c.unknown, c.nvocc], [4, 1, 1, 1, 1, 0]);

// Suggesting how to ask a carrier for a rate.
assert.deepEqual(contactsForCarrier(rows, { code: "ey" }).map((r) => r.id), ["1"]);
assert.deepEqual(contactsForCarrier(rows, { name: "Maersk Line" }).map((r) => r.id), ["2"], "by name");
assert.deepEqual(contactsForCarrier(rows, { name: "Bluesea" }).map((r) => r.id), [], "an agent is not a carrier");
assert.deepEqual(contactsForCarrier(rows, { name: "ab" }), [], "too short a name is never matched");
assert.deepEqual(suggestRateSource(contactsForCarrier(rows, { code: "EY" })), { source: "email", emails: ["cargo@etihad.com"] }, "an address on file: ask by email");
assert.deepEqual(suggestRateSource(contactsForCarrier(rows, { name: "Maersk" })), { source: "portal", emails: ["rates@maersk.com"] }, "what the admin set wins");
assert.deepEqual(suggestRateSource([]), { source: "", emails: [] });

console.log("email-directory tests passed");
