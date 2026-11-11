import assert from "node:assert/strict";
import { FALLBACK_INR, fxSourceText, inrPerUnitFrom, resolveInrRate } from "./fx";

// A typed rate always wins, whatever the currency.
assert.deepEqual(resolveInrRate({ currency: "EUR", customFx: 91.2, live: { EUR: 90.1 } }), { rate: 91.2, source: "typed" });
// Else the live rate for THAT currency (a euro quote is no longer converted at the dollar's rate).
assert.deepEqual(resolveInrRate({ currency: "EUR", live: { EUR: 90.1, USD: 83.4 } }), { rate: 90.1, source: "live" });
// Else an approximate rate for the common ones, said plainly.
assert.equal(resolveInrRate({ currency: "JPY" }).source, "approximate");
assert.equal(resolveInrRate({ currency: "JPY" }).rate, FALLBACK_INR.JPY);
// A currency with no live and no approximate rate has NO rate: the desk must ask, never guess.
assert.deepEqual(resolveInrRate({ currency: "MWK" }), { rate: null, source: "none" });
assert.deepEqual(resolveInrRate({ currency: "" }), { rate: null, source: "none" });
// Rupees are rupees.
assert.deepEqual(resolveInrRate({ currency: "inr", customFx: 5 }), { rate: 1, source: "live" });
// The service gives units per rupee; we use rupees per unit.
const perUnit = inrPerUnitFrom({ USD: 0.012, JPY: 1.79, BAD: 0, NAN: NaN });
assert.ok(Math.abs(perUnit.USD - 83.33) < 0.1);
assert.ok(Math.abs(perUnit.JPY - 0.5587) < 0.01);
assert.equal(perUnit.BAD, undefined);
assert.match(fxSourceText({ rate: 1, source: "approximate" }, "JPY"), /approximate/);
assert.match(fxSourceText({ rate: null, source: "none" }, "MWK"), /no rate is known/);
console.log("fx tests passed");
