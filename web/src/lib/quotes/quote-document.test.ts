import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import { buildClientQuoteDocument, orderOptionsForPack } from "./quote-document";
import type { OptionBreakdown } from "./option-breakdown";
import { optionChargeLines, optionBreakdownsFromQuote } from "./option-breakdown";

const quote: SavedQuote = {
  id: "share-preview",
  customer: "ABC",
  creator: "ganny",
  status: "quoted",
  type: "air",
  amount: 820,
  currency: "USD",
  route: "BLR → GRU via TK",
  date: "2026-09-09",
  details: {
    chargeableWeight: 100,
    airlines: [
      {
        id: "ek",
        name: "EK — Emirates SkyCargo",
        kind: "airline",
        selected: false,
        quoteTotal: 720,
        baseFreight: 680,
        originFeesTotal: 20,
        destFeesTotal: 20,
        routing: "DXB",
        tt: "4",
        validity: "2026-09-20",
      },
      {
        id: "tk",
        name: "TK — Turkish Cargo",
        kind: "airline",
        selected: true,
        quoteTotal: 820,
        baseFreight: 780,
        originFeesTotal: 20,
        destFeesTotal: 20,
        routing: "IST",
        tt: "5",
        validity: "2026-09-18",
      },
    ],
  },
};

const doc = buildClientQuoteDocument(quote);
assert.match(doc.filename, /Quote-.*\.pdf/);
assert.match(doc.pdfFilename, /Quote-.*\.pdf/);
assert.match(doc.emailCover, /Official Freight Quotation/);
assert.match(doc.emailCover, /ABC/);
assert.match(doc.emailCover, /EK — Emirates SkyCargo/);
assert.match(doc.emailCover, /TK — Turkish Cargo/);
assert.match(doc.emailCover, /attached PDF/);
assert.match(doc.shareText, /PDF attached/);
assert.equal(doc.optionCount, 2);
assert.doesNotMatch(doc.html, /data-tab=/);
assert.doesNotMatch(doc.html, /function show\(id\)/);
assert.match(doc.html, /EK — Emirates SkyCargo/);
assert.match(doc.html, /TK — Turkish Cargo/);
// Cheapest first: EK (720) is listed before TK (820); TK keeps its "quoted offer" marker.
assert.match(doc.html, /1 of 2 · alternative/);
assert.match(doc.html, /2 of 2 · quoted offer/);
assert.match(doc.html, /ABC/);
assert.match(doc.html, /atlas-logo\.png/);
const ekAt = doc.html.indexOf("<h3>EK");
const tkAt = doc.html.indexOf("<h3>TK");
assert.ok(ekAt >= 0 && tkAt > ekAt, "options must be listed from the lowest price to the highest");
assert.match(doc.html, /EK — Emirates SkyCargo ★ lowest/);
assert.match(doc.html, /TK — Turkish Cargo ▲ highest/, "the highest price is tagged too, on the customer's copy");
assert.match(doc.emailCover, /EK — Emirates SkyCargo: .*\(lowest\)/);
assert.match(doc.emailCover, /TK — Turkish Cargo: .*\(quoted offer · highest\)/);

// The printed/downloaded/emailed document must show the same shipment
// details as the on-screen preview — not just a compact header line.
assert.match(doc.html, /Chargeable weight/, "on-screen identity rows must also appear in the printed/PDF document");
assert.match(doc.html, /Reference/);
assert.match(doc.html, /BLR → GRU via TK/);

const seaDoc = buildClientQuoteDocument({
  id: "sea-share",
  customer: "Zenith Sea",
  creator: "ganny",
  status: "quoted",
  type: "sea",
  amount: 1730,
  currency: "USD",
  route: "INNSA → NLRTM",
  date: "2026-09-26",
  details: {
    type: "fcl",
    origin: "INNSA",
    destination: "NLRTM",
    incoterm: "CIF",
    grossWeight: 24000,
    volumeCbm: 68,
    liners: [
      {
        id: "cma",
        name: "CMA CGM",
        kind: "liner",
        selected: true,
        quoteTotal: 1730,
        routing: "Nhava Sheva",
        tt: "22",
        validity: "2026-11-01",
      },
    ],
  },
});
assert.match(seaDoc.html, /Gross weight/, "sea-specific identity rows (gross weight, CBM, mode) must reach the printed document too");
assert.match(seaDoc.html, /24000\.00 kg/);
assert.match(seaDoc.html, /68\.00 CBM/);

// Multi-lane, multi-option: each lane is sorted cheapest → highest on its own, lanes keep their order,
// the cheapest and the highest are tagged, unpriced options go last, and a single option has no "highest".
const opt = (id: string, laneId: string, total: number, selected = false) =>
  ({ id, name: id, laneId, laneLabel: laneId, total, selected, cheapest: false }) as unknown as OptionBreakdown;
const packed = orderOptionsForPack([
  opt("L1-b", "L1", 900),
  opt("L1-a", "L1", 500, true),
  opt("L1-none", "L1", 0),
  opt("L1-c", "L1", 700),
  opt("L2-x", "L2", 300),
  opt("L2-y", "L2", 300),
  opt("L3-solo", "L3", 100),
]);
assert.deepEqual(packed.map((o) => o.id), ["L1-a", "L1-c", "L1-b", "L1-none", "L2-x", "L2-y", "L3-solo"]);
const byId = Object.fromEntries(packed.map((o) => [o.id, o]));
assert.equal(byId["L1-a"].cheapest, true);
assert.equal(byId["L1-b"].highest, true);
assert.equal(byId["L1-c"].cheapest || byId["L1-c"].highest, false);
assert.equal(byId["L1-none"].cheapest || byId["L1-none"].highest, false);
assert.equal(byId["L2-x"].highest || byId["L2-y"].highest, false, "no highest when every price is the same");
assert.equal(byId["L2-x"].cheapest && byId["L2-y"].cheapest, true, "tied cheapest are both tagged");
assert.equal(byId["L3-solo"].highest, false, "a lone option is not 'highest'");

const injected: SavedQuote = {
  ...quote,
  customer: `<img src=x onerror=alert(1)>`,
};
const safe = buildClientQuoteDocument(injected);
assert.match(safe.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(safe.html, /<img src=x/);

const ek = optionBreakdownsFromQuote(quote).find((o) => o.id === "ek");
assert.ok(ek);
const lines = optionChargeLines(ek, "USD", 100);
assert.ok(lines.some((l) => l.label === "Origin fees"));
assert.equal(lines[lines.length - 1].label, "Option total");

console.log("quote-document tests passed");
