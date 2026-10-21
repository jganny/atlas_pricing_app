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

// Plain-words instructions the rules half understood are worth a second reading; clear ones are not
import { mergeInstruction, ruleScore, shouldAskAI, weightFromText } from "./instruction";
const plain = "give me the emirates rate for hundred kilo and above with twelve percent markup in dollars at 84";
assert.equal(shouldAskAI(plain, parseInstruction(plain)), true);
const clear = "use EK +100 add 10/kg quote in USD";
assert.equal(ruleScore(parseInstruction(clear)), 4);
assert.equal(shouldAskAI(clear, parseInstruction(clear)), false);
assert.equal(shouldAskAI("ok", parseInstruction("ok")), false, "very short text is not sent");
// The rules win; the AI only fills blanks
const merged = mergeInstruction(parseInstruction("use Emirates rates and add 8%"), { carrier: "WRONG", weightBreak: "plus100", margins: [{ kind: "percent", value: 99 }], currencies: ["USD"], inrRate: 84 });
assert.equal(merged.carrier, "Emirates");
assert.deepEqual(merged.margins, [{ kind: "percent", value: 8 }]);
assert.equal(merged.weightBreak, "plus100");
assert.deepEqual(merged.currencies, ["USD"]);
assert.equal(merged.inrRate, 84);
assert.equal(mergeInstruction(parseInstruction("x"), null).margins.length, 0);
// A weight typed with a quote request; the margin's "/kg" is not a weight
assert.equal(weightFromText("quote air BLR to LHR 120 kg use EK add 10/kg"), 120);
assert.equal(weightFromText("quote air BLR to LHR use EK add 10/kg"), undefined);
assert.equal(weightFromText("85.5kgs to Dubai"), 85.5);
console.log("instruction tests passed");
// Lowercase is fine for a carrier code, and ordinary two-letter words are not carriers
assert.equal(parseInstruction("use ek rates for +100").carrier, "EK");
assert.equal(parseInstruction("with it add 5%").carrier, undefined);
assert.equal(parseInstruction("120 kg +100 add 5%").carrier, undefined);
// Sea: container, full/part load, margin per container or per cbm
const s1 = parseInstruction("use MSC rates for 40HC fcl add 50/container quote in USD");
assert.equal(s1.carrier, "MSC");
assert.equal(s1.container, "40'HC");
assert.equal(s1.seaMode, "fcl");
assert.deepEqual(s1.margins, [{ kind: "perContainer", value: 50 }]);
assert.deepEqual(s1.currencies, ["USD"]);
const s2 = parseInstruction("use ONE rates lcl add 5 per cbm in INR rate 83.5");
assert.equal(s2.seaMode, "lcl");
assert.deepEqual(s2.margins, [{ kind: "perCbm", value: 5 }]);
assert.equal(s2.inrRate, 83.5);
assert.equal(parseInstruction("20 GP add 10%").container, "20'GP");
assert.equal(hasInstruction(parseInstruction("40hq")), true);
import { volumeFromText } from "./instruction";
assert.equal(volumeFromText("lcl 12.5 cbm add 5/cbm"), 12.5);
assert.equal(volumeFromText("lcl add 5/cbm"), undefined);
// A carrier name can be followed straight by the container, break or margin — and filler words are not carriers
assert.equal(parseInstruction("use maersk 40hc add 100/container in usd").carrier, "maersk");
assert.equal(parseInstruction("use Hapag Lloyd rates add 5%").carrier, "Hapag Lloyd");
assert.equal(parseInstruction("use msc lcl add 5/cbm").carrier, "msc");
assert.equal(parseInstruction("with the 100 rate add 5%").carrier, undefined);
assert.equal(parseInstruction("use the latest rates add 5%").carrier, undefined);
