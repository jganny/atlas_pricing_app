import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import { agentsUsed, clientCopyPlan, quoteForClient } from "./client-copy";
import { buildClientQuoteDocument } from "./quote-document";
import { createAirlineOption, createLinerOption, serializeAirlineOption, serializeLinerOption } from "../pricing/carrier-options";

function quote(): SavedQuote {
  return {
    id: "q1",
    customer: "ABC Exports",
    creator: "ganny",
    status: "quoted",
    type: "air",
    amount: 3120,
    currency: "USD",
    route: "FRA → BLR via EK",
    date: "2026-11-10",
    details: {
      module: "import",
      chargeableWeight: 1200,
      termsAndConditions: "Rates are subject to space. Kintetsu World Express will hand over at FRA.",
      airlines: [
        { id: "lh", name: "Lufthansa", kind: "airline", selected: false, quoteTotal: 3480, hideName: true },
        { id: "ek", name: "EK — Emirates SkyCargo", kind: "airline", selected: true, quoteTotal: 3120, agentRate: true, agentName: "Kintetsu World Express" },
        { id: "qr", name: "Qatar Airways", kind: "airline", selected: false, quoteTotal: 3260 },
      ],
    },
  } as unknown as SavedQuote;
}

// --- the plan: which names must not reach the client ---
{
  const plan = clientCopyPlan(quote());
  assert.deepEqual(plan.hidden.map((h) => [h.name, h.label]), [["Lufthansa", "Airline option 1"]]);
  assert.deepEqual(plan.agents, ["Kintetsu World Express"]);
  assert.deepEqual(agentsUsed(quote()), [{ carrier: "EK — Emirates SkyCargo", agent: "Kintetsu World Express" }]);
}

// --- the saved quote is never changed; the client copy is cleaned ---
{
  const q = quote();
  const c = quoteForClient(q);
  const flat = JSON.stringify(c);
  assert.ok(!/Lufthansa/.test(flat), "a hidden carrier name is gone everywhere");
  assert.ok(!/Kintetsu/.test(flat), "an agent's name is gone everywhere, even typed into the terms");
  assert.ok(!/agentName|agentRate/.test(flat), "agent keys are removed");
  assert.match(String(c.details?.termsAndConditions), /our partner will hand over at FRA/);
  assert.ok(/Emirates/.test(flat) && /Qatar Airways/.test(flat), "carriers left visible stay visible");
  assert.ok(/Lufthansa/.test(JSON.stringify(q)) && /Kintetsu/.test(JSON.stringify(q)), "the saved quote keeps the real names");
  assert.equal((c.details?.airlines as Array<{ name: string }>)[0].name, "Airline option 1");
}

// --- a quote with nothing to hide is returned as it is ---
{
  const q = { ...quote(), details: { airlines: [{ id: "a", name: "Qatar Airways", kind: "airline" }] } } as unknown as SavedQuote;
  assert.equal(quoteForClient(q), q);
}

// --- a short code and a whole-word match: hiding EK must not touch BREAK ---
{
  const q = quote();
  (q.details?.airlines as Array<Record<string, unknown>>)[1].hideName = true;
  (q.details as Record<string, unknown>).note = "BREAK bulk at EK hub";
  const c = quoteForClient(q);
  assert.equal(c.route, "FRA → BLR via Airline option 2");
  assert.equal((c.details as Record<string, unknown>).note, "BREAK bulk at Airline option 2 hub");
}

// --- the labels count per lane and say liner / coloader ---
{
  const q = {
    type: "sea",
    details: {
      liners: [
        { id: "a", name: "Hapag-Lloyd", kind: "liner", laneId: "L1", hideName: true },
        { id: "b", name: "Unico Logistics", kind: "coloader", laneId: "L1", hideName: true },
        { id: "c", name: "MSC", kind: "liner", laneId: "L2", hideName: true },
      ],
    },
  } as unknown as SavedQuote;
  assert.deepEqual(clientCopyPlan(q).hidden.map((h) => h.label).sort(), ["Coloader option 2", "Liner option 1", "Liner option 1"]);
}

// --- the desk keeps the settings when it saves and loads a quote ---
{
  const a = createAirlineOption({ name: "EK", hideName: true, agentRate: true, agentName: "  Kintetsu  " }, true);
  const row = serializeAirlineOption(a);
  assert.equal(row.hideName, true);
  assert.equal(row.agentRate, true);
  assert.equal(row.agentName, "Kintetsu", "the name is trimmed");
  const plain = serializeAirlineOption(createAirlineOption({ name: "QR" }, false));
  assert.ok(!("hideName" in plain) && !("agentRate" in plain) && !("agentName" in plain), "nothing extra is written when nothing is set");
  const noName = serializeAirlineOption(createAirlineOption({ name: "QR", agentRate: false, agentName: "Old" }, false));
  assert.ok(!("agentName" in noName), "an agent name without the box ticked is not kept");
  const l = serializeLinerOption(createLinerOption({ name: "MSC", hideName: true, agentRate: true, agentName: "Global Link" }, true));
  assert.equal(l.hideName, true);
  assert.equal(l.agentName, "Global Link");
}

// --- the whole client document: HTML, share text and email cover ---
{
  const doc = buildClientQuoteDocument(quote());
  for (const [label, text] of [["html", doc.html], ["share text", doc.shareText], ["email cover", doc.emailCover], ["title", doc.title], ["subject", doc.shareSubject]] as const) {
    assert.ok(!/Lufthansa/.test(text), `${label}: hidden name`);
    assert.ok(!/Kintetsu/.test(text), `${label}: agent name`);
  }
  assert.match(doc.html, /Airline option 1/);
  assert.match(doc.html, /Qatar Airways/);
}

console.log("client copy ok");
