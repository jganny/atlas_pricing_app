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

// compact one-line answers
const ln = (...f) => [...f, ...Array(15 - f.length).fill("")].join("|");
const good = ln("EK", "BOM", "DXB", "INR", "", "", "unknown", "", "", "28");
const ok = L.parseRowLines("EK|BOM|DXB|INR|2026-09-01|2026-12-31|contract|1500|31|28.5|26|24.5|||fuel extra\nEK|BLR|LHR||||published||||||||");
assert.equal(ok.rows.length, 2);
assert.deepEqual(L.normalizeRows(ok, "EK")[0], { carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR", breaks: { min: 1500, minus45: 31, plus45: 28.5, plus100: 26, plus300: 24.5, plus500: null, plus1000: null }, validFrom: "2026-09-01", validTo: "2026-12-31", rateKind: "contract", notes: "fuel extra" });
assert.equal(L.normalizeRows(ok, "EK")[1].currency, "", "a missing currency is never guessed");
assert.equal(L.normalizeRows(ok, "EK")[1].breaks.plus45, null, "an empty field stays empty, never 0");
// a header line, commentary and bullets do not become routes; bullets and fences around a real line are tolerated
assert.equal(L.parseRowLines(L.FIELDS.join("|") + "\n" + good).rows.length, 1, "a header line is skipped, the real line kept");
assert.equal(L.parseRowLines(L.FIELDS.join("|")), null, "only a header: unreadable");
assert.equal(L.parseRowLines("- " + good).rows.length, 1);
assert.equal(L.parseRowLines("Here are the rates:\n" + good).rows.length, 1);
assert.deepEqual(L.parseRowLines("NONE"), { rows: [] });
assert.deepEqual(L.parseRowLines("  none "), { rows: [] });
assert.deepEqual(L.parseRowLines(""), { rows: [] });
assert.equal(L.parseRowLines("I could not read this document."), null, "words but no route: unreadable");
assert.equal(L.parseRowLines("EK|BOM|DXB|INR|too|few"), null, "wrong number of fields is not a route");
assert.equal(L.parseRowLines(ln("EK", "BOMBAY", "DXB", "INR")), null, "a long place name is not an airport code");
assert.equal(L.FIELDS.length, 15);
assert.match(a, /exactly 15 fields/);

// long sheets are cut into parts, each with the column headings, overlapping a little, nothing lost
const lines = Array.from({ length: 100 }, (_, i) => (i === 0 ? "Origin,Dest,Min,N" : i < 6 ? `heading ${i}` : `BOM${i},DXB,${i},1.${i}`));
const csv = lines.join("\n");
const parts = L.chunkSheets([{ name: "BLR", csv }], { maxChars: 400, headerLines: 3, overlap: 2 });
assert.ok(parts.length > 3);
assert.match(parts[0].label, /BLR \(part 1 of /);
for (const p of parts.slice(1)) assert.match(p.text, /Origin,Dest,Min,N\nheading 1\nheading 2/, "each later part repeats the headings");
for (const p of parts) assert.ok(p.text.length < 400 + 400, "parts stay small");
const seenLines = new Set(parts.flatMap((p) => p.text.split("\n")));
for (const l of lines) assert.ok(seenLines.has(l), `line kept: ${l}`);
// consecutive parts overlap by the chosen number of lines
const firstBody = parts[0].text.split("\n").filter((l) => l.startsWith("BOM"));
const secondBody = parts[1].text.split("\n").filter((l) => l.startsWith("BOM"));
assert.ok(secondBody[0] <= firstBody[firstBody.length - 1], "the next part starts before the previous one ended");
assert.equal(L.chunkSheets([{ name: "S", csv: "a,b\n1,2\n" }])[0].label, "S", "a short sheet is one part with no part numbers");
assert.equal(L.chunkSheets([{ name: "Empty", csv: ",,\n\n" }]).length, 0, "an empty sheet gives nothing");
assert.equal(L.chunkSheets([{ name: "A", csv: "x\ny" }, { name: "B", csv: "p\nq" }]).length, 2, "each sheet is its own part");
// one very long line cannot loop forever
assert.equal(L.chunkSheets([{ name: "L", csv: "h\n" + "x".repeat(5000) + "\nz" }], { maxChars: 100, headerLines: 1, overlap: 1 }).length >= 2, true);

// rows from overlapping parts are merged without repeats
const r1 = { carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR", n: 1 };
const r2 = { carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR", n: 2 };
const r3 = { carrierCode: "EK", origin: "BOM", destination: "LHR", currency: "INR", n: 3 };
assert.deepEqual(L.mergeRows([[r1], [r2, r3]]).map((r) => r.n), [1, 3]);
assert.deepEqual(L.mergeRows([]), []);

// limited parallelism keeps order and never exceeds the limit
(async () => {
  let running = 0;
  let peak = 0;
  const res = await L.mapLimit([5, 1, 4, 2, 3, 6], 3, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, n * 5));
    running--;
    return n * 10;
  });
  assert.deepEqual(res, [50, 10, 40, 20, 30, 60]);
  assert.ok(peak <= 3 && peak >= 2);
  assert.deepEqual(await L.mapLimit([], 3, async () => 1), []);
  console.log("carrier reader logic ok");
})();
