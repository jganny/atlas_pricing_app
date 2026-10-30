import assert from "node:assert/strict";
import { createAirlineOption } from "@/lib/pricing/carrier-options";
import { loadAirDeskFromQuote } from "./desk-loader";
import { buildAirDraftQuote, draftAge, draftIsStale, draftTitle, draftsForViewer, type DraftRow } from "./drafts";

// A draft reopens through the same loader Amend uses, with the carriers and charges intact
const ek = createAirlineOption({ name: "EK", routing: "BLR-DXB", validity: "2026-12-01", breaks: { plus100: { sell: 5.2, buy: 4.4 } } }, true);
const quote = buildAirDraftQuote({
  customer: "TATA STEEL", origin: "BLR", destination: "DXB", currency: "USD", incoterm: "FOB", module: "export", dimUnit: "cms",
  customFx: 0, terms: "T&C", creator: "shashank", commodity: "GENERAL", cargo: [{ l: 100, w: 80, h: 90, qty: 1, gw: 150 }],
  airlines: [ek], lanes: [{ id: "lane_0", origin: "BLR", destination: "DXB" }],
  localOriginCharges: [{ name: "Handling", sell: 50, buy: 40, unit: "flat" }], destClearanceCharges: [],
});
assert.equal(quote.status, "draft");
const back = loadAirDeskFromQuote(JSON.parse(JSON.stringify(quote)));
assert.equal(back.customer, "TATA STEEL");
assert.equal(back.airlines[0].name, "EK");
assert.equal(back.airlines[0].breaks.plus100?.sell, 5.2);
assert.equal(back.airlines[0].validity, "2026-12-01", "validity is kept exactly as set");
assert.equal(back.cargo[0].gw, 150);
assert.equal(back.localOriginCharges[0].name, "Handling");
assert.equal(back.terms, "T&C");

assert.deepEqual(draftTitle("", "", ""), { customer: "No customer yet", route: "No route yet" });
assert.deepEqual(draftTitle("Bosch", "MAA - Chennai", "HAM"), { customer: "Bosch", route: "MAA → HAM" });

const row = (over: Partial<DraftRow>): DraftRow => ({ id: "d", mode: "air", seat: "air-nom", creator: "shashank", customer: "C", route: "", waitingFor: "", quote, step: "shipment", savedAt: 1, ...over });
const rows = [row({ id: "a", savedAt: 5 }), row({ id: "b", mode: "sea", savedAt: 9 }), row({ id: "c", seat: "freehand", creator: "kavya", savedAt: 7 })];
assert.deepEqual(draftsForViewer(rows, "shashank").map((r) => r.id), ["b", "a"], "a desk sees its own drafts, newest first");
assert.deepEqual(draftsForViewer(rows, "shashank", "air").map((r) => r.id), ["a"]);
assert.deepEqual(draftsForViewer(rows, "kavya").map((r) => r.id), ["c"]);
assert.equal(draftsForViewer(rows, "stranger").length, 0);

const now = Date.UTC(2026, 9, 30);
assert.equal(draftIsStale(now - 2 * 86_400_000, now), false);
assert.equal(draftIsStale(now - 3 * 86_400_000, now), true);
assert.equal(draftAge(now - 2 * 86_400_000, now), "2 days ago");
assert.equal(draftAge(now, now), "today");
console.log("drafts tests passed");
