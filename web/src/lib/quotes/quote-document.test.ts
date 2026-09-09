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
assert.match(doc.filename, /Quote-.*\.html/);
assert.match(doc.shareText, /EK — Emirates SkyCargo/);
assert.match(doc.shareText, /TK — Turkish Cargo/);
assert.match(doc.shareText, /quoted offer/);
assert.match(doc.shareText, /A PDF cannot switch airlines/);
assert.equal(doc.optionCount, 2);
assert.match(doc.html, /data-tab=/);
assert.match(doc.html, /EK — Emirates SkyCargo/);
assert.match(doc.html, /TK — Turkish Cargo/);
assert.match(doc.html, /function show\(id\)/);
assert.match(doc.html, /@media print/);
assert.match(doc.html, /ABC/);

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
