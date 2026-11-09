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

// weight columns: the AI says where each printed column starts, the code matches them to our breaks
assert.equal(L.breakForThreshold(0), "minus45");
assert.equal(L.breakForThreshold(44), "minus45");
assert.deepEqual([45, 100, 300, 500, 1000].map(L.breakForThreshold), ["plus45", "plus100", "plus300", "plus500", "plus1000"]);
assert.equal(L.breakForThreshold(250), null, "a weight we hold no column for is never guessed");
assert.equal(L.breakForThreshold(-1), null);
assert.equal(L.breakForThreshold(NaN), null);
assert.deepEqual(L.mapThresholds([0, 100, 300]), ["minus45", "plus100", "plus300"]);
assert.deepEqual(L.mapThresholds([45, 100]), ["plus45", "plus100"]);
assert.equal(L.mapThresholds([0, 250]), null);
assert.equal(L.mapThresholds([0, 10]), null, "two columns on the same break are ambiguous");

// compact answers: a COLUMNS line, then one line per route (8 leading fields, one rate per column, notes)
const ln = (n, ...f) => [...f, ...Array(8 + n + 1 - f.length).fill("")].join("|");
const ok = L.parseRowLines(["COLUMNS|0|45|100|300", ln(4, "EK", "BOM", "DXB", "INR", "2026-09-01", "2026-12-31", "contract", "1500", "31", "28.5", "26", "24.5", "fuel extra"), ln(4, "EK", "BLR", "LHR", "", "", "", "published")].join("\n"));
assert.equal(ok.rows.length, 2);
assert.deepEqual(ok.columns, [0, 45, 100, 300]);
assert.deepEqual(L.normalizeRows(ok, "EK")[0], { carrierCode: "EK", origin: "BOM", destination: "DXB", currency: "INR", breaks: { min: 1500, minus45: 31, plus45: 28.5, plus100: 26, plus300: 24.5, plus500: null, plus1000: null }, validFrom: "2026-09-01", validTo: "2026-12-31", rateKind: "contract", notes: "fuel extra" });
assert.equal(L.normalizeRows(ok, "EK")[1].currency, "", "a missing currency is never guessed");
assert.equal(L.normalizeRows(ok, "EK")[1].breaks.plus45, null, "an empty field stays empty, never 0");

// the same numbers under different printed columns land on different breaks (this is what two reads used to disagree about)
const three = (cols) => L.normalizeRows(L.parseRowLines([`COLUMNS|${cols.join("|")}`, ln(cols.length, "6E", "BOM", "ALA", "INR", "", "", "published", "", "280", "210", "165")].join("\n")), "6E")[0].breaks;
assert.deepEqual([three([45, 100, 300]).plus45, three([45, 100, 300]).plus100, three([45, 100, 300]).plus300], [280, 210, 165]);
assert.deepEqual([three([100, 300, 500]).plus100, three([100, 300, 500]).plus300, three([100, 300, 500]).plus500], [280, 210, 165]);

// unreadable replies are flagged, never taken to mean "no routes"
assert.equal(L.parseRowLines(ln(2, "EK", "BOM", "DXB")), null, "route lines without a COLUMNS line");
assert.equal(L.parseRowLines("COLUMNS|0|250\n" + ln(2, "EK", "BOM", "DXB", "INR")), null, "a weight we have no column for");
assert.equal(L.parseRowLines("COLUMNS|0|abc\n" + ln(2, "EK", "BOM", "DXB", "INR")), null);
assert.equal(L.parseRowLines("COLUMNS\n" + ln(0, "EK", "BOM", "DXB")), null, "no column weights at all");
assert.equal(L.parseRowLines("COLUMNS|0|45"), null, "only the COLUMNS line");
assert.equal(L.parseRowLines("COLUMNS|0|45\n" + ln(1, "EK", "BOM", "DXB", "INR")), null, "a route line with the wrong number of fields is not a route");
assert.equal(L.parseRowLines("COLUMNS|0|45\n" + ln(2, "EK", "BOMBAY", "DXB", "INR")), null, "a long place name is not an airport code");
assert.equal(L.parseRowLines(""), null, "an empty reply is flagged, not read as no routes");
assert.equal(L.parseRowLines("   \n "), null);
assert.equal(L.parseRowLines("I could not read this document."), null);
assert.equal(L.parseRowLines("None of these routes are listed."), null, "words that merely start with none are not a valid empty read");
assert.deepEqual(L.parseRowLines("NONE"), { rows: [], columns: [] });
assert.deepEqual(L.parseRowLines("  none. "), { rows: [], columns: [] });
// tolerated: bullets, text before the real lines, a header line repeated for each part
assert.equal(L.parseRowLines("- COLUMNS|0|45\n- " + ln(2, "EK", "BOM", "DXB", "INR")).rows.length, 1);
assert.equal(L.parseRowLines("Here you go:\ncolumns|0|45\n" + ln(2, "EK", "BOM", "DXB", "INR") + "\nCOLUMNS|0|45\n" + ln(2, "EK", "BLR", "DXB", "INR")).rows.length, 2);
assert.match(a, /COLUMNS/);

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

// --- Carrier Board -> Air desk: what gets published ---
{
  const b = L.deskBreaksFromRow({ breaks: { min: 8600, minus45: 430, plus45: null, plus100: 340, plus300: 300, plus500: "290", plus1000: 0 } });
  assert.deepEqual(b.min, { sell: 0, buy: 8600 }, "the airline's rate is BUY; SELL is never filled");
  assert.deepEqual(b.plus45, { sell: 0, buy: 0 }, "an empty break stays zero");
  assert.deepEqual(b.plus500, { sell: 0, buy: 290 });
  assert.equal(L.deskBreaksFromRow({ breaks: { min: null } }), null, "no usable rate: nothing to publish");
  assert.equal(L.deskBreaksFromRow(null), null);
  assert.equal(L.carrierNameFor("EK", "Emirates SkyCargo", {}), "Emirates SkyCargo");
  assert.equal(L.carrierNameFor("EK", "EK", { EK: "Emirates" }), "Emirates", "a code-only circular record uses the airline list");
  assert.equal(L.carrierNameFor("ZZ", "", {}), "ZZ");
  const plan = L.planDeskPublish(
    [
      { carrierCode: "EK", origin: "BLR", destination: "FRA", currency: "INR", validFrom: "2026-07-01", validTo: "2026-12-31", breaks: { min: 8600, plus300: 300 } },
      { carrierCode: "EK", origin: "BLR", destination: "LHR", currency: "INR", breaks: { min: null } },
      { carrierCode: "EK", origin: "BLR", destination: "CDG", currency: "", breaks: { plus300: 300 } },
    ],
    { "BLR|FRA": "docA" },
    { circularCarrier: "EK", circularId: "c1", names: { EK: "Emirates" } },
  );
  assert.equal(plan.length, 1, "rows with no rate or no currency are skipped");
  assert.equal(plan[0].docId, "docA", "the existing record for the lane is replaced, not duplicated");
  assert.equal(plan[0].data.carrier, "Emirates");
  assert.equal(plan[0].data.source, "carrier_board");
  assert.equal(plan[0].data.published, true);
  assert.equal(plan[0].data.validTo, "2026-12-31");
}

// --- auto-read decisions ---
{
  assert.deepEqual(L.parseAutoSettings(null), { enabled: true, monthlyCapUsd: 3 }, "no settings saved yet: on, $3 a month");
  assert.deepEqual(L.parseAutoSettings({ enabled: false, monthlyCapUsd: 5 }), { enabled: false, monthlyCapUsd: 5 });
  assert.deepEqual(L.parseAutoInput({ enabled: true, monthlyCapUsd: "4.505" }), { enabled: true, monthlyCapUsd: 4.51 });
  assert.match(L.parseAutoInput({ enabled: true, monthlyCapUsd: -1 }).error, /monthly limit/);
  assert.match(L.parseAutoInput({ enabled: true, monthlyCapUsd: "abc" }).error, /monthly limit/);
  assert.equal(L.autoDecision({ enabled: true, monthlyCapUsd: 3 }, 0).run, true);
  assert.equal(L.autoDecision({ enabled: true, monthlyCapUsd: 3 }, 2.69).run, true, "still room for one more read");
  const over = L.autoDecision({ enabled: true, monthlyCapUsd: 3 }, 2.8);
  assert.equal(over.run, false, "a read that could pass the limit is not started");
  assert.match(over.reason, /limit \(\$3\.00, \$2\.80 used\)/);
  assert.equal(L.autoDecision({ enabled: false, monthlyCapUsd: 3 }, 0).run, false);
  assert.equal(L.autoDecision({ enabled: true, monthlyCapUsd: 0 }, 0).run, false, "a limit of 0 pauses auto-read");
}
