const assert = require("node:assert/strict");
const P = require("./inbox-poll-logic");

// only mail newer than the cursor, oldest first, capped
assert.deepEqual(P.nextUids([5, 3, 9, 7], 4, 10), [5, 7, 9]);
assert.deepEqual(P.nextUids([5, 3, 9, 7], 4, 2), [5, 7], "a backlog is taken oldest first, a few at a time");
assert.deepEqual(P.nextUids([5, 3, 9, 7], 0, 2, true), [7, 9], "the very first run takes the latest few");
// the server answers "*" with the last message even when nothing is new: it is not read again
assert.deepEqual(P.nextUids([100], 100, 10), []);
assert.deepEqual(P.nextUids([1551415, "1551416", 1551416, null, "x", 2.5], 1551414, 10), [1551415, 1551416], "bad entries and repeats are dropped");
assert.deepEqual(P.nextUids(undefined, 5, 3), []);
// the cursor only moves forward
assert.equal(P.nextCursor(100, [101, 105], null, false), 105);
assert.equal(P.nextCursor(100, [], null, false), 100);
assert.equal(P.nextCursor(undefined, [7, 9], 500, true), 500, "first run: jump to the newest message");
assert.equal(P.nextCursor(undefined, [7, 9], null, true), 9);
assert.equal(P.nextCursor(undefined, [], null, true), null);
console.log("inbox poll logic ok");

// --- learning who never sends enquiries ---
{
  const Q = require("./inbox-poll-logic");
  assert.equal(Q.senderKey("Buyer@Acme.com"), "acme.com", "a company is known by its domain");
  assert.equal(Q.senderKey("someone@gmail.com"), "someone@gmail.com", "a shared mail host is never judged as a whole");
  assert.equal(Q.senderKey("not an address"), "");
  assert.equal(Q.senderKey(""), "");
  assert.equal(Q.senderNeverEnquires({ asked: 5, kept: 0 }), true);
  assert.equal(Q.senderNeverEnquires({ asked: 4, kept: 0 }), false, "not yet");
  assert.equal(Q.senderNeverEnquires({ asked: 9, kept: 1 }), false, "one real enquiry is enough to keep asking");
  assert.equal(Q.senderNeverEnquires(undefined), false);
  assert.equal(Q.senderNeverEnquires({}), false);
}

// --- attachments from the mail server's description of the parts ---
{
  const Q = require("./inbox-poll-logic");
  const bs = { type: "multipart/mixed", childNodes: [
    { type: "multipart/alternative", childNodes: [{ type: "text/plain", size: 120 }, { type: "text/html", size: 900 }] },
    { type: "application/pdf", disposition: "attachment", dispositionParameters: { filename: "TK_BOM_TARIFF.pdf" }, size: 880000 },
    { type: "image/png", disposition: "inline", parameters: { name: "logo.png" }, size: 2400 },
    { type: "application/octet-stream", disposition: "attachment", size: 10 },
  ] };
  assert.deepEqual(Q.attachmentsFromStructure(bs), [
    { filename: "TK_BOM_TARIFF.pdf", contentType: "application/pdf", size: 880000, inline: false },
    { filename: "logo.png", contentType: "image/png", size: 2400, inline: true },
    { filename: "", contentType: "application/octet-stream", size: 10, inline: false },
  ]);
  assert.deepEqual(Q.attachmentsFromStructure({ type: "text/plain", size: 50 }), [], "a plain mail has none");
  assert.deepEqual(Q.attachmentsFromStructure(undefined), []);
}
