import assert from "node:assert/strict";
import {
  buildQuoteEmailDraft,
  lastInkRow,
  pdfPageCount,
  quoteEmailSharePayload,
  trimmedCaptureHeight,
  usablePdfPageHeight,
  whatsAppShareUrl,
} from "./quote-print";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const emptyBody = buildQuoteEmailDraft({
  subject: "Freight quotation AEJEC0926IN70934 — JECKSON ENGINEERS",
  body: "",
  filename: "Quote-AEJEC0926IN70934.pdf",
  pdfBytes,
});

assert.match(emptyBody, /Content-Type: application\/pdf/);
assert.match(emptyBody, /filename="Quote-AEJEC0926IN70934.pdf"/);
assert.match(emptyBody, /X-Unsent: 1/);
assert.doesNotMatch(emptyBody, /Official Freight Quotation/);
assert.doesNotMatch(emptyBody, /Airline options/);
assert.doesNotMatch(emptyBody, /attached PDF matches/);
assert.doesNotMatch(emptyBody, /ATLAS LOGISTICS/);
const textBody = emptyBody.match(
  /Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 7bit\r\n\r\n([\s\S]*?)\r\n------=_VertexQuotePdf/,
)?.[1];
assert.equal(textBody, "", "email draft body must be empty");

const shareFile = new File([pdfBytes], "Quote-AEJEC0926IN70934.pdf", { type: "application/pdf" });
const sharePayload = quoteEmailSharePayload(shareFile, "Freight quotation AEJEC0926IN70934");
assert.equal("text" in sharePayload, false, "Safari Mail puts share text into the body");
assert.equal(sharePayload.title, "Freight quotation AEJEC0926IN70934");
assert.equal(sharePayload.files?.length, 1);

const a4 = 841.89;
const margin = 36;
assert.equal(usablePdfPageHeight(a4, margin), a4 - 72);
assert.equal(pdfPageCount(700, a4, margin), 1);
assert.equal(pdfPageCount(769, a4, margin), 1);
assert.ok(pdfPageCount(900, a4, margin) >= 2);

const width = 4;
const height = 6;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 255;
  pixels[i + 1] = 255;
  pixels[i + 2] = 255;
  pixels[i + 3] = 255;
}
// ink on row 2 only
for (let x = 0; x < width; x++) {
  const i = (2 * width + x) * 4;
  pixels[i] = 20;
  pixels[i + 1] = 20;
  pixels[i + 2] = 20;
}
assert.equal(lastInkRow(pixels, width, height), 2);
assert.equal(trimmedCaptureHeight(2, 6, 1), 3);

const wa = whatsAppShareUrl("Atlas quotation AEJEC0926IN70934");
assert.match(wa, /^https:\/\/wa\.me\/\?text=/);
assert.doesNotMatch(wa, /api\.whatsapp\.com/);

console.log("quote-print draft tests passed");
