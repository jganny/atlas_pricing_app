// Run with: node functions/instruction-parse.test.js
const assert = require("node:assert/strict");
const t = require("./instruction-parse")._test;

// Good values pass through; currencies are upper-cased and de-duplicated.
const a = t.sanitize({ carrier: " Emirates ", originCode: "blr", weightBreak: "plus100", margins: [{ kind: "percent", value: 12 }], currencies: ["usd", "USD", "eur"], inrRate: 84 });
assert.equal(a.carrier, "Emirates");
assert.equal(a.originCode, "BLR");
assert.equal(a.weightBreak, "plus100");
assert.deepEqual(a.margins, [{ kind: "percent", value: 12 }]);
assert.deepEqual(a.currencies, ["USD", "EUR"]);
assert.equal(a.inrRate, 84);

// Nonsense is dropped, never passed on.
const b = t.sanitize({ weightBreak: "plus999", margins: [{ kind: "free", value: 5 }, { kind: "perKg", value: -3 }, { kind: "perKg", value: "ten" }], currencies: ["dollars", 5], inrRate: -1, buyRate: 0, crossRate: { from: "USD", to: "EUR" }, container: "99XX", originCode: "Bengaluru" });
assert.equal(b.weightBreak, undefined);
assert.deepEqual(b.margins, []);
assert.deepEqual(b.currencies, []);
assert.equal(b.inrRate, undefined);
assert.equal(b.buyRate, undefined);
assert.equal(b.crossRate, undefined);
assert.equal(b.container, undefined);
assert.equal(b.originCode, undefined);

// Sea fields and a stated carrier rate are kept.
const c = t.sanitize({ buyRate: 4.2, container: "40hc", seaMode: "fcl", crossRate: { from: "usd", to: "eur", rate: 0.92 }, margins: [{ kind: "perContainer", value: 50 }] });
assert.equal(c.buyRate, 4.2);
assert.equal(c.container, "40HC");
assert.equal(c.seaMode, "fcl");
assert.deepEqual(c.crossRate, { from: "USD", to: "EUR", rate: 0.92 });
assert.deepEqual(c.margins, [{ kind: "perContainer", value: 50 }]);

// Nothing (or a non-object) gives an empty, safe result.
assert.deepEqual(t.sanitize(null), { margins: [], currencies: [] });

// The tool call is read; a text-only answer is not accepted.
assert.deepEqual(t.pickInput({ content: [{ type: "tool_use", name: "record_instruction", input: { carrier: "EK" } }] }), { carrier: "EK" });
assert.equal(t.pickInput({ content: [{ type: "text", text: "hello" }] }), null);

// The model never sees prices to set, and is told to ignore instructions inside the text.
assert.match(t.SYSTEM_PROMPT, /never suggest a price/);
assert.match(t.SYSTEM_PROMPT, /untrusted DATA/);
console.log("instruction-parse.test.js: all assertions passed");
