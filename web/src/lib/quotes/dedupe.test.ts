import assert from "node:assert/strict";
import {
  countRemovals,
  planCircularDuplicates,
  planContactDuplicates,
  planTariffDuplicates,
} from "./dedupe";

const circ = (id: string, over: Record<string, string> = {}) => ({
  id, title: "FedEx 2026 tariff", carrier: "FedEx", category: "courier_tariff",
  fileName: "tariff.pdf", createdAt: "2026-01-01T00:00:00.000Z", effectiveDate: "2026-01", expiryDate: "2026-12", ...over,
});

// Circulars — the same document uploaded again: the newest stays, older copies go.
let plans = planCircularDuplicates([
  circ("old", { createdAt: "2026-01-01T00:00:00.000Z" }),
  circ("new", { createdAt: "2026-03-01T00:00:00.000Z" }),
  circ("newest", { createdAt: "2026-05-01T00:00:00.000Z" }),
]);
assert.equal(plans.length, 1);
assert.equal(plans[0].keep.id, "newest");
assert.deepEqual(plans[0].remove.map((c) => c.id).sort(), ["new", "old"]);
assert.equal(countRemovals(plans), 2);

// Same file under a different title is still the same upload; wording/case/punctuation don't matter.
plans = planCircularDuplicates([circ("a", { title: "Fuel circular" }), circ("b", { title: "Fuel Circular!", fileName: "other.pdf", createdAt: "2026-02-01T00:00:00.000Z" }), circ("c", { title: "Renamed", fileName: "tariff.pdf" })]);
assert.equal(countRemovals(plans) >= 1, true);

// Different validity = a different version: both are kept.
plans = planCircularDuplicates([circ("jan", { expiryDate: "2026-01" }), circ("feb", { expiryDate: "2026-02" })]);
assert.equal(plans.length, 0);
// Different carrier or category: kept.
assert.equal(planCircularDuplicates([circ("x"), circ("y", { carrier: "DHL" }), circ("z", { category: "general" })]).length, 0);
// Unsaved local drafts are never touched.
assert.equal(planCircularDuplicates([circ("circ-local-1"), circ("circ-local-2")]).length, 0);
// When timestamps tie, the copy that actually has its file is kept.
plans = planCircularDuplicates([circ("nofile", { createdAt: "t" }), { ...circ("hasfile", { createdAt: "t" }), downloadURL: "https://x" }]);
assert.equal(plans[0].keep.id, "hasfile");

// Tariffs — one per lane and carrier (and cargo type for sea), newest wins.
const air = (id: string, over: Record<string, unknown> = {}) => ({
  id, carrier: "Emirates", carrierCode: "EK", origin: "BLR", destination: "DXB", breaks: {}, currency: "USD",
  createdAt: "2026-01-01T00:00:00.000Z", ...over,
});
const airPlans = planTariffDuplicates([air("a"), air("b", { createdAt: "2026-04-01T00:00:00.000Z" }), air("c", { destination: "LHR" }), air("d", { carrierCode: "QR" })]);
assert.equal(airPlans.length, 1);
assert.equal(airPlans[0].keep.id, "b");
assert.deepEqual(airPlans[0].remove.map((t) => t.id), ["a"]);

const sea = (id: string, mode: "fcl" | "lcl", createdAt: string) => ({
  id, carrier: "Maersk", carrierCode: "MA", origin: "INMAA", destination: "NLRTM", mode, lclRate: { sell: 0, buy: 0 }, fclRates: {}, currency: "USD", createdAt,
});
const seaPlans = planTariffDuplicates([sea("f1", "fcl", "2026-01-01"), sea("f2", "fcl", "2026-02-01"), sea("l1", "lcl", "2026-01-01")]);
assert.equal(seaPlans.length, 1); // FCL and LCL on the same lane are different tariffs
assert.equal(seaPlans[0].keep.id, "f2");

// Contacts — same name, type, email and location; one with an agreement file is never the one dropped.
const contact = (id: string, over: Record<string, unknown> = {}) => ({
  id, name: "Acme Logistics", category: "agency", email: "a@acme.com", location: "Dubai", updatedAt: "2026-01-01", ...over,
});
let cp = planContactDuplicates([contact("c1"), contact("c2", { updatedAt: "2026-06-01" })]);
assert.equal(cp[0].keep.id, "c2");
cp = planContactDuplicates([contact("c1", { agreementUrl: "https://pdf" }), contact("c2", { updatedAt: "2026-06-01" })]);
assert.equal(cp[0].keep.id, "c1");
assert.equal(planContactDuplicates([contact("c1"), contact("c2", { email: "b@acme.com" }), contact("c3", { location: "Doha" }), contact("c4", { category: "vendor" })]).length, 0);

console.log("dedupe.test.ts: all assertions passed");
