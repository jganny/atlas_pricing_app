const assert = require("node:assert/strict");
const D = require("./circular-digest-logic");

assert.deepEqual(D.DIGEST_CATEGORIES.includes("airline_tariff"), false, "airline rate tables have their own reader");
assert.ok(D.DIGEST_CATEGORIES.includes("line_circular") && D.DIGEST_CATEGORIES.includes("general"));
assert.match(D.SYSTEM, /CIRCULAR DIGEST/);

const ok = D.parseDigest('Here you go:\n```json\n{"kind":"warehouse","company":" Safe Store ","effectiveFrom":"2026-12-01","validTo":"soon","summary":["Storage rate rises.", ""],"charges":[{"name":"Storage","amount":"1,250.50","currency":"inr","unit":"per pallet per week"},{"name":"Handling","amount":"n/a"}],"deadlines":["Pay by 5 Dec"]}\n```');
assert.equal(ok.kind, "warehouse");
assert.equal(ok.company, "Safe Store");
assert.equal(ok.validTo, "", "a date that is not a date is dropped, never guessed");
assert.deepEqual(ok.summary, ["Storage rate rises."]);
assert.deepEqual(ok.charges.map((c) => [c.name, c.amount, c.currency]), [["Storage", 1250.5, "INR"], ["Handling", null, ""]]);
assert.equal(D.parseDigest('{"kind":"nonsense","summary":["x"]}').kind, "other", "an unknown kind becomes other");
assert.equal(D.parseDigest("no json here"), null);
assert.equal(D.parseDigest("{not json}"), null);
assert.equal(D.parseDigest('{"kind":"liner","summary":[],"charges":[]}'), null, "nothing in it, no digest");
assert.equal(D.parseDigest(null), null);
const many = D.parseDigest(JSON.stringify({ summary: Array.from({ length: 20 }, (_, i) => "Point " + i), charges: Array.from({ length: 60 }, (_, i) => ({ name: "C" + i })) }));
assert.equal(many.summary.length, 8);
assert.equal(many.charges.length, 40);
console.log("circular digest logic ok");
