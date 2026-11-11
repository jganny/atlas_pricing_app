import assert from "node:assert/strict";
import { blockers, currencyClash, readToAirOption, readToLinerOption, sellFromBuy, type RateRead } from "./rate-email";
import { quoteForClient } from "../quotes/client-copy";
import { serializeAirlineOption } from "../pricing/carrier-options";
import type { SavedQuote } from "../types";

const read = (over: Partial<RateRead> = {}): RateRead => ({
  vendor: "Prashant R Parab, Air Logistics Group", fromEmail: "p@alg.in", mode: "air", airlineCode: "NH", airlineName: "All Nippon Airways", currency: "INR", currencyAssumed: true, basis: "all-in",
  breaks: { plus500: 730, min: 2500 }, containers: [], lclPerCbm: null, charges: [], validity: "", transit: "", routing: "AMD-LRD", remarks: "", hasRates: true, needsCheck: [], ...over,
});

// Margin: added to a per-kg rate; a percentage applies to everything; a minimum charge is a total, so a per-kg margin is not added to it.
assert.equal(sellFromBuy(730, { mode: "perUnit", amount: 20 }), 750);
assert.equal(sellFromBuy(730, { mode: "percent", percent: 10 }), 803);
assert.equal(sellFromBuy(2500, { mode: "perUnit", amount: 20 }, true), 0, "left for a person");
assert.equal(sellFromBuy(2500, { mode: "percent", percent: 10 }, true), 2750);

// An air read becomes an airline option: buy = the vendor's rate, sell = buy + margin, tagged as from email and (for an agent) hidden from the customer.
const o = readToAirOption(read(), { isAgent: true, agentName: "Air Logistics Group", margin: { mode: "perUnit", amount: 20 } });
assert.equal(o.name, "All Nippon Airways");
assert.deepEqual(o.breaks.plus500, { buy: 730, sell: 750 });
assert.deepEqual(o.breaks.min, { buy: 2500, sell: 0 });
assert.equal(o.agentRate, true);
assert.equal(o.agentName, "Air Logistics Group");
assert.equal(o.fromEmail, true);
assert.equal(o.rateLock, true);
assert.equal(o.selected, false);

// The agent's name never reaches the customer, and a left-out option is not sent.
const quote = { id: "q", customer: "C", creator: "x", status: "quoted", type: "air", amount: 1, currency: "INR", route: "AMD-LRD", date: "2026-11-11", details: { module: "import", airlines: [{ ...serializeAirlineOption(o), selected: true }, { ...serializeAirlineOption(readToAirOption(read({ airlineName: "Emirates", airlineCode: "EK" }), { isAgent: true, agentName: "Other Agent", margin: { mode: "percent", percent: 5 } })), exclude: true }], termsAndConditions: "Handed over by Air Logistics Group." } } as unknown as SavedQuote;
const client = JSON.stringify(quoteForClient(quote));
assert.ok(!/Air Logistics Group|Other Agent|Emirates/.test(client), "no agent name and no left-out option");

// What stops a rate being added.
assert.deepEqual(blockers(read(), {}), []);
assert.deepEqual(blockers(read({ currency: "", needsCheck: ["currency"] }), {}), ["Choose the currency."]);
assert.deepEqual(blockers(read({ currency: "", needsCheck: ["currency"] }), { currency: "USD" }), []);
assert.deepEqual(blockers(read({ airlineName: "", airlineCode: "", needsCheck: ["airline"] }), {}), ["Name the airline."]);
assert.deepEqual(blockers(read({ airlineName: "", needsCheck: ["airline"] }), { airlineName: "Qatar Airways" }), []);
assert.deepEqual(blockers(read({ hasRates: false }), {}), ["No rates were found in this email."]);

// Sea: container buy and sell, LCL per cbm.
const sea = readToLinerOption(read({ mode: "sea", airlineName: "", containers: [{ type: "20'GP", label: "", rate: 1450 }, { type: "40'HC", label: "", rate: 2300 }], lclPerCbm: 55 }), { isAgent: true, margin: { mode: "perUnit", amount: 100 }, carrierName: "Agent rate 1" });
assert.deepEqual(sea.containers.map((c) => [c.type, c.buyRate, c.sellRate]), [["20'GP", 1450, 1550], ["40'HC", 2300, 2400]]);
assert.equal(sea.lclBuy, 55);
assert.equal(sea.lclSell, 155);
assert.equal(sea.agentRate, true);

// Different currencies cannot go on one desk.
assert.equal(currencyClash([{ currency: "INR" }, { currency: "INR" }]), null);
assert.match(currencyClash([{ currency: "INR" }, { currency: "USD" }]) ?? "", /different currencies/);
console.log("rate-email web tests passed");

// The conversation's one-line summary of an automatic read.
{
  const { rateSummary } = require("./rate-email") as typeof import("./rate-email");
  const sum = rateSummary({ vendor: "ALG", fromEmail: "p@alg.in", mode: "air", airlineCode: "NH", airlineName: "All Nippon Airways", currency: "INR", currencyAssumed: true, basis: "all-in", breaks: { plus500: 730 }, containers: [], lclPerCbm: null, charges: [], validity: "", transit: "", routing: "", remarks: "", hasRates: true, needsCheck: [] });
  assert.equal(sum.line, "500 kg+: 730/kg · all-in · INR (assumed: sent within India) · All Nippon Airways");
  assert.equal(sum.confirm, "");
  const unsure = rateSummary({ vendor: "A", fromEmail: "a@x.com", mode: "air", airlineCode: "", airlineName: "", currency: "", currencyAssumed: false, basis: "", breaks: { min: 2500 }, containers: [], lclPerCbm: null, charges: [], validity: "", transit: "", routing: "", remarks: "", hasRates: true, needsCheck: ["currency", "airline"] });
  assert.equal(unsure.confirm, "Please confirm: currency, airline.");
  console.log("rate summary ok");
}
