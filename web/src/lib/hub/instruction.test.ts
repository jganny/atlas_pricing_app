import assert from "node:assert/strict";
import { hasInstruction, parseInstruction } from "./instruction";

// The example from the sales team
const a = parseInstruction("use BLR - EK rates for +100 and add a margin of 10/kg or 10% and quote in USD or EUR with exchange rate 83.5");
assert.equal(a.originCode, "BLR");
assert.equal(a.carrier, "EK");
assert.equal(a.weightBreak, "plus100");
assert.deepEqual(a.margins, [{ kind: "perKg", value: 10 }, { kind: "percent", value: 10 }], "both margins are kept, as a choice");
assert.deepEqual(a.currencies, ["USD", "EUR"]);
assert.equal(a.inrRate, 83.5);
assert.equal(hasInstruction(a), true);

// One clear margin per kg; the number after "+" is the break, not part of the margin
const b = parseInstruction("EK rates +300, margin 12 per kg, in USD @ 84.2");
assert.equal(b.carrier, "EK");
assert.equal(b.weightBreak, "plus300");
assert.deepEqual(b.margins, [{ kind: "perKg", value: 12 }]);
assert.deepEqual(b.currencies, ["USD"]);
assert.equal(b.inrRate, 84.2);

// Percent only; "100+" spelling; a name instead of a code
const c = parseInstruction("use Emirates rates for 100+ and add 8 percent");
assert.equal(c.carrier, "Emirates");
assert.equal(c.weightBreak, "plus100");
assert.deepEqual(c.margins, [{ kind: "percent", value: 8 }]);

// A cross rate is not an INR rate
const d = parseInstruction("QR rates, quote in EUR, 1 USD = 0.92 EUR, add 5%");
assert.deepEqual(d.crossRate, { from: "USD", to: "EUR", rate: 0.92 });
assert.equal(d.inrRate, undefined);
assert.equal(d.carrier, "QR");

// Minimum and under-45 breaks
assert.equal(parseInstruction("use EK min rate").weightBreak, "min");
assert.equal(parseInstruction("EK rates under 45, 5/kg").weightBreak, "minus45");

// Nothing to act on -> plain drop
assert.equal(hasInstruction(parseInstruction("please quote this urgently, thanks")), false);
assert.equal(hasInstruction(parseInstruction("")), false);
// Numbers that are not breaks are left alone
assert.equal(parseInstruction("add 10/kg").weightBreak, undefined);
assert.equal(parseInstruction("add 10/kg").carrier, undefined);
// A currency code is never mistaken for an airport/carrier pair
assert.equal(parseInstruction("quote in USD/EUR").carrier, undefined);
console.log("instruction tests passed");
