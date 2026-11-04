const assert = require("node:assert/strict");
const T = require("./tariff-checks");

const row = (o = {}) => ({ carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR", breaks: { min: 1500, minus45: 31, plus45: 28.5, plus100: 26, plus300: 24.5 }, ...o });

// numbers agree within half a percent
assert.ok(T.sameNumber(31, 31.1));
assert.ok(!T.sameNumber(31, 33));
assert.ok(T.sameNumber(null, undefined));
assert.ok(!T.sameNumber(31, null));

// a normal row has no problems; zero, missing currency, and rates that rise with weight are caught
assert.deepEqual(T.rowProblems(row()), []);
assert.match(T.rowProblems(row({ breaks: { plus45: 0 } })).join(" "), /zero or negative/);
assert.match(T.rowProblems(row({ currency: "" })).join(" "), /currency is missing/);
assert.match(T.rowProblems(row({ breaks: { minus45: 25, plus45: 30 } })).join(" "), /should not rise with weight/);
assert.match(T.rowProblems(row({ breaks: {} })).join(" "), /No rates could be read/);

// both reads agree, new route: applied
let r = T.decide([row()], [row()], []);
assert.equal(r.apply.length, 1);
assert.equal(r.hold.length, 0);

// both reads agree, identical to file: nothing to do
r = T.decide([row()], [row()], [row()]);
assert.equal(r.unchanged.length, 1);
assert.equal(r.apply.length, 0);

// the reads disagree on a figure: held, with the numbers in the reason; the old rate stays
const misread = row({ breaks: { min: 1500, minus45: 31, plus45: 38.5, plus100: 26, plus300: 24.5 } });
r = T.decide([row()], [misread], [row()]);
assert.equal(r.apply.length, 0);
assert.equal(r.hold.length, 1);
assert.match(r.hold[0].reasons[0], /disagree on plus45 \(28.5 vs 38.5\)/);

// a small honest change is applied and described
const moved = row({ breaks: { min: 1500, minus45: 32, plus45: 29, plus100: 26, plus300: 24.5 } });
r = T.decide([moved], [moved], [row()]);
assert.equal(r.apply.length, 1);
assert.deepEqual(r.apply[0].changes.map((c) => c.break), ["minus45", "plus45"]);

// a jump of more than 40% is held even if both reads agree (could be a misprint in the circular itself)
const jump = row({ breaks: { min: 1500, minus45: 60, plus45: 55, plus100: 50, plus300: 45 } });
r = T.decide([jump], [jump], [row()]);
assert.equal(r.hold.length, 1);
assert.match(r.hold[0].reasons.join(" "), /moved by \d+%/);

// a route found by only one read is never applied
r = T.decide([row(), row({ destination: "LHR" })], [row()], []);
assert.equal(r.apply.length, 1);
assert.equal(r.hold.length, 1);
assert.match(r.hold[0].reasons[0], /second read did not find/);
r = T.decide([row()], [row(), row({ destination: "LHR" })], []);
assert.match(r.hold[0].reasons[0], /first read did not find/);

// the same route in another currency is a different row (INR is never mixed with USD)
r = T.decide([row({ currency: "USD" })], [row({ currency: "USD" })], [row()]);
assert.equal(r.apply.length, 1);
assert.equal(T.rowKey(row()), "EK|BOM|DXB|INR");

console.log("tariff checks ok");
