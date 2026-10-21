import assert from "node:assert/strict";
import { parseDeskIntent } from "@/lib/ai/desk-intent";
import { askPrefill } from "./ask-instruction";

function prefillFor(text: string) {
  const intent = parseDeskIntent(text);
  assert.equal(intent.kind, "new", `"${text}" opens a new quote`);
  return intent.kind === "new" ? askPrefill(text, intent) : null;
}

// Lane, weight and the instruction all arrive on the desk
const a = prefillFor("quote air BLR to LHR 120 kg use ek +100 add 10/kg in usd");
assert.ok(a);
assert.equal(a.parsed.origin, "BLR");
assert.equal(a.parsed.destination, "LHR");
assert.equal(a.parsed.grossWeight, 120);
assert.deepEqual(a.parsed.packages, [{ qty: 1, gw: 120 }]);
assert.match(a.instruction ?? "", /use ek \+100/);

// The margin's "/kg" is never mistaken for the cargo weight
const b = prefillFor("quote air BLR to LHR use EK +100 add 10/kg in USD");
assert.ok(b);
assert.equal(b.parsed.grossWeight, undefined);
assert.deepEqual(b.parsed.packages, []);

// A plain request opens the desk exactly as before
assert.equal(prefillFor("quote air BLR to LHR"), null);
assert.equal(prefillFor("quote sea INMAA to AEJEA"), null);
assert.equal(parseDeskIntent("quote courier BLR to LHR use EK").kind === "new" ? askPrefill("x use EK", { mode: "courier" }) : "x", null, "other desks are not covered");

// Sea: seaport codes, volume and weight, and the instruction
const s = prefillFor("quote sea INMAA to AEJEA 12 cbm 3400 kg use msc 40hc add 50/container in usd");
assert.ok(s);
assert.equal(s.mode, "sea");
assert.equal(s.parsed.origin, "INMAA");
assert.equal(s.parsed.destination, "AEJEA");
assert.equal(s.parsed.volume, 12);
assert.equal(s.parsed.grossWeight, 3400);
assert.match(s.instruction ?? "", /use msc 40hc/);
// A per-cbm margin is not read as the cargo volume
assert.equal(prefillFor("quote sea INMAA to AEJEA use ONE lcl add 5/cbm")?.parsed.volume, undefined);
console.log("ask-instruction tests passed");
