import assert from "node:assert/strict";
import type { SavedQuote } from "../types";
import { buildClientQuoteDocument } from "./quote-document";
import { DOC_LANGS, bi, biPlain, languageForEmail, quoteDocLang, translate, type DocLang } from "./quote-language";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Language follows the customer's country, only where it is clear.
assert.equal(languageForEmail("buyer@acme.ae"), "ar");
assert.equal(languageForEmail("ventas@empresa.es"), "es");
assert.equal(languageForEmail("a@b.com.br"), "pt");
assert.equal(languageForEmail("a@b.de"), "de");
assert.equal(languageForEmail("a@b.fr"), "fr");
assert.equal(languageForEmail("a@b.it"), "it");
assert.equal(languageForEmail("someone@gmail.com"), "en", "a generic address says nothing about the country");
assert.equal(languageForEmail("a@b.in"), "en");
assert.equal(languageForEmail(""), "en");
assert.equal(quoteDocLang({ inboxRef: { fromEmail: "x@y.ae" } }), "ar");
assert.equal(quoteDocLang({ details: { docLanguage: "en" }, inboxRef: { fromEmail: "x@y.ae" } }), "en", "the desk's choice beats the suggestion");
assert.equal(quoteDocLang({ details: { docLanguage: "klingon" } }), "en");

// English first, local language beside it; a phrase with no translation stays English; English-only is unchanged.
assert.equal(bi("en", "Routing", esc), "Routing");
assert.equal(biPlain("es", "Routing"), "Routing · Itinerario");
assert.match(bi("ar", "Routing", esc), /^Routing · <span lang="ar" dir="rtl">خط السير<\/span>$/);
assert.equal(bi("es", "Carrier Name Surcharge", esc), "Carrier Name Surcharge");
assert.equal(translate("en", "Routing"), null);

// Every language has every phrase (a gap would silently show English).
for (const l of DOC_LANGS.filter((x) => x.id !== "en")) for (const p of ["Customer", "Route", "Validity", "Option total", "Terms & conditions", "Official Freight Quotation"]) assert.ok(translate(l.id, p), `${l.id}: ${p}`);

const quote: SavedQuote = {
  id: "lang", customer: "Al Noor Trading", creator: "ganny", status: "quoted", type: "air", amount: 820, currency: "USD", route: "BOM → DXB", date: "2026-11-11",
  grossProfit: 123457, grossProfitCurrency: "USD",
  details: {
    chargeableWeight: 100, termsAndConditions: "Rates subject to space and equipment.", baseBuyFreight: 654321, buyTotal: 654321,
    airlines: [
      { id: "ek", name: "EK — Emirates SkyCargo", kind: "airline", selected: false, quoteTotal: 720, baseFreight: 680, originFeesTotal: 20, destFeesTotal: 20, routing: "DXB", tt: "4", validity: "2026-11-20" },
      { id: "tk", name: "TK — Turkish Cargo", kind: "airline", selected: true, quoteTotal: 820, baseFreight: 780, originFeesTotal: 20, destFeesTotal: 20, routing: "IST", tt: "5", validity: "2026-11-18" },
    ],
  },
};

// English-only output is exactly what it was.
const en = buildClientQuoteDocument(quote);
assert.doesNotMatch(en.html, /lang="(ar|es|fr|de|pt|it)"/);

// Every language: both languages present, the money and names untouched, terms stay English with a note, and NO profit or cost wording
// in any language, ever.
const forbidden = /gross profit|\bGP\b|profit|margin|buy rate|from buy|ganancia|beneficio|margen|bénéfice|marge|Gewinn|Marge|lucro|margem|utile|margine|ربح|هامش|تكلفة الشراء/i;
for (const l of DOC_LANGS.filter((x) => x.id !== "en")) {
  const lang = l.id as DocLang;
  const built = buildClientQuoteDocument(quote, [], { language: lang });
  const visible = built.html.replace(/<style[\s\S]*?<\/style>/gi, " ") + " " + built.emailCover;
  assert.match(built.html, new RegExp(`lang="${lang}"`), `${lang}: local text is marked with its language`);
  assert.match(built.html, /Routing/, `${lang}: English is still there`);
  assert.ok(built.html.includes(translate(lang, "Routing")!), `${lang}: Routing in the local language`);
  assert.ok(built.html.includes(translate(lang, "Official Freight Quotation")!));
  assert.ok(built.emailCover.includes(translate(lang, "The attached PDF matches this quotation. It lists every option from lowest to highest price, with the full charge breakup for each one.")!), `${lang}: email closing in both languages`);
  assert.match(built.html, /Rates subject to space and equipment\./, `${lang}: terms stay in English`);
  assert.ok(built.html.includes(translate(lang, "(in English)")!), `${lang}: the document says the terms are in English`);
  assert.match(built.html, /EK — Emirates SkyCargo/);
  assert.match(visible, /820/);
  assert.doesNotMatch(visible, forbidden, `${lang}: no profit or cost wording`);
  for (const secret of ["123457", "123,457", "654321", "654,321"]) assert.ok(!visible.includes(secret), `${lang}: must not contain ${secret}`);
}
assert.match(buildClientQuoteDocument(quote, [], { language: "ar" }).html, /dir="rtl"/);

console.log("quote-language tests passed");
