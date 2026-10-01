import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import { buildClientQuoteDocument } from "./quote-document";
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
assert.match(doc.html, /1 of 2 · quoted offer/);
assert.match(doc.html, /2 of 2 · alternative/);
assert.match(doc.html, /ABC/);
assert.match(doc.html, /atlas-logo\.png/);
const quotedAt = doc.html.indexOf("quoted offer");
const altAt = doc.html.indexOf("alternative");
assert.ok(quotedAt >= 0 && altAt > quotedAt, "quoted offer must appear before alternatives in the pack");

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
