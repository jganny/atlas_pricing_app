import assert from "node:assert/strict";
import { parseInstruction } from "./instruction";
import { planInstruction } from "./instruction-quote";
import type { AirTariff } from "@/lib/types";

const tariff = (o: Partial<AirTariff>): AirTariff => ({
  id: "t", carrier: "Emirates", carrierCode: "EK", origin: "BLR", destination: "BEY", currency: "USD",
  breaks: { plus45: { sell: 3.4, buy: 3.0 }, plus100: { sell: 3.2, buy: 2.8 }, plus300: { sell: 2.9, buy: 2.5 } }, createdAt: "2026-10-01", ...o,
});
const tariffs = [tariff({}), tariff({ id: "q", carrier: "Qatar Airways", carrierCode: "QR", breaks: { plus100: { sell: 3.5, buy: 3.1 } } })];
const base = { tariffs, originCode: "BLR", destCode: "BEY", chargeableKg: 145 };

// The sales team's example: two margins and two currencies are left to the person, nothing is guessed
const i1 = parseInstruction("use BLR - EK rates for +100 and add a margin of 10/kg or 10% and quote in USD or EUR with exchange rate 83.5");
let p = planInstruction({ ...base, instr: i1 });
assert.equal(p.status, "choose");
assert.equal(p.choices.margin?.length, 2);
assert.deepEqual(p.choices.currency, ["USD", "EUR"]);
assert.equal(p.weightBreak, "plus100");
// Once chosen: USD 2.80 cost + 10/kg = 12.80
p = planInstruction({ ...base, instr: i1, choice: { margin: 0, currency: "USD" } });
assert.equal(p.status, "ready");
assert.equal(p.buyRate, 2.8, "the carrier's own (buy) rate is the base");
assert.equal(p.sellRate, 12.8);
assert.equal(p.customFx, 83.5);
assert.match(p.summary, /EK · BLR→BEY · \+100 · USD 2\.80 \+ 10\/kg = USD 12\.80\/kg · rate 83\.5/);
// …or 10%
p = planInstruction({ ...base, instr: i1, choice: { margin: 1, currency: "USD" } });
assert.equal(p.sellRate, 3.08);
// Quoting in EUR needs a rate between USD and EUR; the INR rate cannot stand in for it
p = planInstruction({ ...base, instr: i1, choice: { margin: 1, currency: "EUR" } });
assert.equal(p.status, "blocked");
assert.match(p.summary, /exchange rate to quote in EUR/);

// One clear instruction is ready at once; the break can come from the weight
const i2 = parseInstruction("EK rates, add 10%, in USD");
p = planInstruction({ ...base, instr: i2, chargeableKg: 350 });
assert.equal(p.status, "ready");
assert.equal(p.weightBreak, "plus300");
assert.equal(p.sellRate, 2.75);
assert.match(p.summary, /\(by weight\)/);

// Cross rate converts the carrier rate
const i3 = parseInstruction("QR rates +100, add 0.5/kg, quote in EUR, 1 USD = 0.92 EUR");
p = planInstruction({ ...base, instr: i3 });
assert.equal(p.currency, "EUR");
assert.equal(p.buyRate, 2.85, "3.10 USD x 0.92");
assert.equal(p.sellRate, 3.35);
// Quoting in INR with an INR rate
p = planInstruction({ ...base, instr: parseInstruction("EK +100 add 10/kg in INR rate 97.66") });
assert.equal(p.buyRate, 273.45, "2.80 x 97.66");
assert.equal(p.sellRate, 283.45);

// No margin is said plainly, not hidden
p = planInstruction({ ...base, instr: parseInstruction("use EK rates for +100") });
assert.equal(p.sellRate, 2.8);
assert.ok(p.issues.some((x) => /No margin/.test(x)));

// Nothing is invented when the rate is not on file
p = planInstruction({ ...base, instr: parseInstruction("use XX rates +100") });
assert.equal(p.status, "blocked");
assert.match(p.summary, /XX has no rate on file for BLR → BEY/);
assert.deepEqual(p.choices.carriers?.map((c) => c.code), ["EK", "QR"], "carriers that DO have a +100 rate are offered");
assert.deepEqual(p.askRate, { carrier: "XX", currency: "USD" }, "or the person can type the rate");
p = planInstruction({ ...base, destCode: "DXB", instr: i2 });
assert.match(p.summary, /No rates on file for BLR → DXB/);
assert.deepEqual(p.askRate, { carrier: "EK", currency: "USD" });
p = planInstruction({ ...base, instr: parseInstruction("EK rates +1000 add 5%") });
assert.match(p.summary, /no \+1000 rate/);
assert.deepEqual(p.choices.breaks?.map((b) => b.label), ["+45", "+100", "+300"], "the breaks the sheet does have are offered");
// Picking one of them settles it
p = planInstruction({ ...base, instr: parseInstruction("EK rates +1000 add 5%"), choice: { weightBreak: "plus300" } });
assert.equal(p.status, "ready");
assert.equal(p.weightBreak, "plus300");
assert.equal(p.sellRate, 2.63, "2.50 + 5%");
// No carrier named: the carriers with a rate are offered
p = planInstruction({ ...base, instr: parseInstruction("add 5%"), chargeableKg: 120 });
assert.match(p.summary, /Which carrier/);
assert.deepEqual(p.choices.carriers?.map((c) => c.code), ["EK", "QR"]);
p = planInstruction({ ...base, instr: parseInstruction("add 5%"), chargeableKg: 120, choice: { carrier: "QR" } });
assert.equal(p.status, "ready");
assert.equal(p.carrierLabel, "Qatar Airways");
assert.equal(p.sellRate, 3.26, "3.10 + 5%");
// A rate the person typed stands in for a missing sheet, and says so
p = planInstruction({ ...base, destCode: "DXB", instr: i2, choice: { buyRate: 4 } });
assert.equal(p.status, "ready");
assert.equal(p.typedRate, true);
assert.equal(p.buyRate, 4);
assert.equal(p.sellRate, 4.4);
assert.equal(p.carrierLabel, "Emirates", "the airline's full name is borrowed from another sheet on file");
assert.ok(p.issues.some((x) => /typed in/.test(x)));
// …and a rate stated inside the instruction itself works the same way
p = planInstruction({ ...base, destCode: "DXB", instr: { ...parseInstruction("XX +100 add 10/kg in USD"), buyRate: 4.2 } });
assert.equal(p.sellRate, 14.2);
assert.equal(p.carrierLabel, "XX");
// Sea-style margins are refused for air with a plain reason
assert.match(planInstruction({ ...base, instr: { ...i2, margins: [{ kind: "perContainer", value: 50 }] } }).summary, /sea quote/);
assert.match(planInstruction({ ...base, destCode: "", instr: i2 }).summary, /Origin and destination/);
// Matches by name too, and the newest sheet wins
const newer = [tariff({ createdAt: "2026-09-01", breaks: { plus100: { sell: 9, buy: 9 } } }), tariff({ id: "n", createdAt: "2026-10-09" })];
assert.equal(planInstruction({ ...base, tariffs: newer, instr: parseInstruction("use Emirates rates +100 add 1/kg") }).buyRate, 2.8);
console.log("instruction-quote tests passed");
