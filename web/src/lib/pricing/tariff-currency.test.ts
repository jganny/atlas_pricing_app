import assert from "node:assert/strict";
import { currencyClashes, sameCurrency } from "./tariff-currency";

assert.equal(sameCurrency("USD", "usd"), true);
assert.equal(sameCurrency("INR", "Rs"), true, "rupee spellings agree");
assert.equal(sameCurrency("USD", "INR"), false);
assert.equal(sameCurrency(undefined, "USD"), true, "an unlabelled tariff counts as USD, as the app has always read it");
assert.equal(sameCurrency("", "INR"), false);

const clashes = currencyClashes(
  [
    { carrier: "EK", tariffCurrency: "USD" },
    { carrier: "ek", tariffCurrency: "USD" }, // the same carrier twice is listed once
    { carrier: "QR", tariffCurrency: "INR" }, // agrees with the quote
    { carrier: "TK", tariffCurrency: "EUR" },
    null,
    undefined,
  ],
  "INR",
);
assert.deepEqual(clashes.map((c) => `${c.carrier}:${c.tariffCurrency}`), ["EK:USD", "TK:EUR"]);
assert.deepEqual(currencyClashes([{ carrier: "EK", tariffCurrency: "USD" }], "USD"), [], "no clash, no notice");
console.log("tariff-currency tests passed");
