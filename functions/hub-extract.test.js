// Run with: node functions/hub-extract.test.js
const assert = require("node:assert/strict");
const t = require("./hub-extract")._test;

// Flat tool fields become the nested shape the app uses.
const a = t.toNested({ mode: "air", senderName: "Li", senderEmail: "l@x.com", senderCompany: "X Ltd", originText: "BLR", originCode: "BLR", originCountry: "IN", destinationText: "CMB", destinationCode: "CMB", destinationCountry: "LK" });
assert.deepEqual(a.sender, { name: "Li", email: "l@x.com", company: "X Ltd" });
assert.deepEqual(a.destination, { text: "CMB", code: "CMB", country: "LK" });
assert.equal(a.senderName, undefined);

// Stray tool-call markup leaked by the model is stripped.
const b = t.toNested({ senderName: '\n<parameter name="name">G. Deganjali', originText: '<parameter name="text">BLR' });
assert.equal(b.sender.name, "G. Deganjali");
assert.equal(b.origin.text, "BLR");

// An already-nested answer still works.
const c = t.toNested({ sender: { name: "A", email: "a@b.com", company: "B" }, origin: { text: "Chennai", code: "INMAA", country: "IN" } });
assert.equal(c.sender.company, "B");
assert.equal(c.origin.code, "INMAA");

// A tool call is preferred; a JSON reply in text is the fallback; nothing → null.
assert.equal(t.pickExtraction({ content: [{ type: "tool_use", name: "record_shipment", input: { mode: "sea", originText: "X" } }] }).origin.text, "X");
assert.equal(t.pickExtraction({ content: [{ type: "text", text: 'Here: {"mode":"air","senderCompany":"Q"} done' }] }).sender.company, "Q");
assert.equal(t.pickExtraction({ content: [] }), null);

// The request asks (not forces) a tool call — forcing is rejected by this model.
assert.deepEqual(t.buildRequestBody(t.validateDocs([{ name: "a", kind: "text", text: "x" }]), {}).tool_choice, { type: "auto" });
console.log("hub-extract.test.js: all assertions passed");
