import assert from "node:assert/strict";
import { buildQuoteEmailDraft } from "./quote-print";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const eml = buildQuoteEmailDraft({
  subject: "Freight quotation AECAR0926IN00837 — CARGOCOMPASS",
  body: "Please find our official freight quotation attached as PDF.",
  filename: "Quote-AECAR0926IN00837.pdf",
  pdfBytes,
});

assert.match(eml, /Content-Type: application\/pdf/);
assert.match(eml, /filename="Quote-AECAR0926IN00837.pdf"/);
assert.match(eml, /X-Unsent: 1/);
assert.match(eml, /attached as PDF/);

console.log("quote-print draft tests passed");
