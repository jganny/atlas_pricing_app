const assert = require("node:assert/strict");
const { _test: t } = require("./rate-requests");

assert.deepEqual(t.parseEmails("A@x.com; b@y.com, a@x.com not-an-email"), ["a@x.com", "b@y.com"]);
assert.deepEqual(t.parseEmails(""), []);
assert.equal(t.parseEmails("a@x.com b@x.com c@x.com d@x.com").length, 3, "at most 3 addresses per contact");

const ok = { ref: "RQ-ABC123", subject: "Rate request | Air export | BOM to BEY | RQ-ABC123", body: "Dear partner, please quote the lane below.", recipients: [{ id: "1", name: "Agent A", email: "a@x.com" }] };
assert.equal(t.validateRequest(ok).error, undefined);
assert.match(t.validateRequest({ ...ok, ref: "bad" }).error, /reference/);
assert.match(t.validateRequest({ ...ok, subject: "No ref here" }).error, /reference/, "subject must carry the reference so replies can be matched");
assert.match(t.validateRequest({ ...ok, body: "short" }).error, /Write the request/);
assert.match(t.validateRequest({ ...ok, recipients: [] }).error, /at least one/);
assert.match(t.validateRequest({ ...ok, recipients: [{ id: "1", name: "x", email: "bad" }] }).error, /valid email/);
const many = Array.from({ length: t.MAX_PER_REQUEST + 1 }, (_, i) => ({ id: String(i), name: "n", email: `u${i}@x.com` }));
assert.match(t.validateRequest({ ...ok, recipients: many }).error, /at most/);
// Two contacts sharing an address: the second is dropped, never emailed twice.
const dup = t.validateRequest({ ...ok, recipients: [{ id: "1", name: "A", email: "a@x.com" }, { id: "2", name: "B", email: "A@x.com" }] });
assert.equal(dup.recipients.length, 1);

assert.match(t.toHtml("Hi <b>x</b>\n\nLine 2"), /Hi &lt;b&gt;x&lt;\/b&gt;/, "message text is escaped");
assert.equal(t.istDay(Date.parse("2026-10-20T20:00:00Z")), "20261021", "the day rolls over at midnight India time");
console.log("rate-requests.test.js: all assertions passed");
