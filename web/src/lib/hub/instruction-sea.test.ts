import assert from "node:assert/strict";
import { parseInstruction } from "./instruction";
import { planSeaInstruction } from "./instruction-sea";
import type { SeaTariff } from "@/lib/types";

const tariff = (o: Partial<SeaTariff>): SeaTariff => ({
  id: "m", carrier: "MSC", carrierCode: "MSC", origin: "INMAA", destination: "AEJEA", mode: "fcl", currency: "USD",
  lclRate: { sell: 0, buy: 0 }, fclRates: { "20'GP": { sell: 900, buy: 800 }, "40'HC": { sell: 1700, buy: 1500 } }, createdAt: "2026-10-01", ...o,
});
const lcl = tariff({ id: "l", mode: "lcl", carrier: "ONE", carrierCode: "ONE", lclRate: { sell: 40, buy: 35 }, fclRates: {} });
const tariffs = [tariff({}), tariff({ id: "h", carrier: "Hapag-Lloyd", carrierCode: "HL", fclRates: { "20'GP": { sell: 950, buy: 850 } } }), lcl];
const base = { tariffs, originCode: "INMAA", destCode: "AEJEA", mode: "fcl" as const, containers: [{ type: "40'HC", qty: 2 }] };

// Full container: the carrier's own (buy) rate plus the margin per container, for the containers on the desk
let p = planSeaInstruction({ ...base, instr: parseInstruction("use MSC rates add 50/container quote in USD") });
assert.equal(p.status, "ready");
assert.deepEqual(p.containers, [{ type: "40'HC", qty: 2, buyRate: 1500, sellRate: 1550 }]);
assert.match(p.summary, /MSC · INMAA→AEJEA · 2×40'HC USD 1500\.00 \+ 50\/container = USD 1550\.00/);
// A container named in the instruction wins over the desk's
p = planSeaInstruction({ ...base, instr: parseInstruction("use MSC rates 20GP add 10%") });
assert.deepEqual(p.containers, [{ type: "20'GP", qty: 1, buyRate: 800, sellRate: 880 }]);
// Part load: per cbm, picked by the instruction even when the desk says FCL
p = planSeaInstruction({ ...base, instr: parseInstruction("use ONE rates lcl add 5/cbm in USD") });
assert.equal(p.status, "ready");
assert.equal(p.mode, "lcl");
assert.equal(p.lclBuy, 35);
assert.equal(p.lclSell, 40);
// INR with a rate converts the per-cbm rate
p = planSeaInstruction({ ...base, mode: "lcl", instr: parseInstruction("use ONE rates add 2/cbm in INR rate 83.5") });
assert.equal(p.lclBuy, 2922.5);
assert.equal(p.lclSell, 2924.5);
// Two margins / currencies are left to the person
p = planSeaInstruction({ ...base, instr: parseInstruction("use MSC rates add 50/container or 5% quote in USD or EUR") });
assert.equal(p.status, "choose");
assert.equal(p.choices.margin?.length, 2);
assert.deepEqual(p.choices.currency, ["USD", "EUR"]);

// Nothing is invented: a container the sheet lacks offers the ones it has, plus typing the rate
p = planSeaInstruction({ ...base, instr: parseInstruction("use HL rates 40HC add 50/container") });
assert.equal(p.status, "blocked");
assert.match(p.summary, /HL has no 40'HC rate/);
assert.deepEqual(p.choices.containers, [{ type: "20'GP", rate: 850 }]);
assert.deepEqual(p.askRate, { carrier: "HL", currency: "USD", unit: "container" });
p = planSeaInstruction({ ...base, instr: parseInstruction("use HL rates 40HC add 50/container"), choice: { container: "20'GP" } });
assert.equal(p.status, "ready");
assert.equal(p.containers?.[0].buyRate, 850);
// A carrier with no sheet: others that have the rate are offered
p = planSeaInstruction({ ...base, instr: parseInstruction("use ZIM rates add 5%") });
assert.deepEqual(p.choices.carriers?.map((c) => c.code), ["MSC"], "only liners that have the 40'HC rate");
// No carrier named at all
p = planSeaInstruction({ ...base, instr: parseInstruction("add 5%") });
assert.match(p.summary, /Which liner/);
// A typed rate stands in for a missing sheet and says so
p = planSeaInstruction({ ...base, destCode: "NLRTM", instr: parseInstruction("use MSC rates add 50/container in USD"), choice: { buyRate: 2000 } });
assert.equal(p.status, "ready");
assert.equal(p.typedRate, true);
assert.equal(p.containers?.[0].sellRate, 2050);
assert.equal(p.carrierLabel, "MSC");
assert.ok(p.issues.some((x) => /typed in/.test(x)));
// No lane at all asks for the rate, and wrong-mode margins are refused plainly
assert.deepEqual(planSeaInstruction({ ...base, destCode: "NLRTM", instr: parseInstruction("use MSC rates") }).askRate, { carrier: "MSC", currency: "USD", unit: "container" });
assert.match(planSeaInstruction({ ...base, instr: parseInstruction("use MSC rates add 5/kg") }).summary, /air quote/);
assert.match(planSeaInstruction({ ...base, instr: parseInstruction("use MSC rates add 5/cbm") }).summary, /part loads/);
assert.match(planSeaInstruction({ ...base, mode: "bb", instr: parseInstruction("use MSC rates") }).summary, /Break-bulk/);
console.log("instruction-sea tests passed");
