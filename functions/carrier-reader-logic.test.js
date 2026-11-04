const assert = require("node:assert/strict");
const L = require("./carrier-reader-logic");

assert.equal(L.toNumber("1,250.50"), 1250.5);
assert.equal(L.toNumber(31), 31);
assert.equal(L.toNumber(" "), null);
assert.equal(L.toNumber("n/a"), null);
assert.equal(L.toNumber(null), null);

const rows = L.normalizeRows(
  {
    rows: [
      { carrierCode: "ek", origin: "bom", destination: "dxb", currency: "inr", validFrom: "2026-09-01", validTo: "soon", rateKind: "contract", breaks: { min: "1,500", minus45: 31, plus45: "28.5", plus100: null, plus300: "n/a" } },
      { carrierCode: "EK", origin: "BOM", destination: "", currency: "INR", breaks: {} },
      { origin: "BLR", destination: "LHR", breaks: { plus45: 0 } },
      null,
    ],
  },
  "TK",
);
assert.equal(rows.length, 2, "a row without a route is dropped");
assert.deepEqual(rows[0], { carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR", breaks: { min: 1500, minus45: 31, plus45: 28.5, plus100: null, plus300: null, plus500: null, plus1000: null }, validFrom: "2026-09-01", validTo: "", rateKind: "contract", notes: "" });
assert.equal(rows[1].carrierCode, "TK", "the airline from the circular's own record fills a missing code");
assert.equal(rows[1].currency, "", "a missing currency is never guessed");
assert.equal(rows[1].breaks.plus45, 0);
assert.deepEqual(L.normalizeRows(null), []);
assert.deepEqual(L.normalizeRows([{ origin: "BOM", destination: "DXB", currency: "USD", breaks: { plus45: 3 } }]).map((r) => r.currency), ["USD"]);

assert.equal(L.tariffDocId({ carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR" }), "EK_BOM_DXB_INR");
assert.equal(L.tariffDocId({ carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "" }), "EK_BOM_DXB_NA");
assert.equal(L.fileKind("Tariff.PDF"), "pdf");
assert.equal(L.fileKind("BLR TARIFF.xlsx"), "sheet");
assert.equal(L.fileKind("", "circulars/x/1_Fuel.XLSX"), "sheet");
assert.equal(L.fileKind("a.docx"), "other");

const [a, b] = L.systemPrompts();
assert.notEqual(a, b);
assert.match(a, /row by row/);
assert.match(b, /each weight-break column/);
assert.match(a, /Do not guess the currency/);
console.log("carrier reader logic ok");
