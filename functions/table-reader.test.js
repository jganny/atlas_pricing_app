const assert = require("node:assert/strict");
const T = require("./table-reader");

const HEAD = "RATE CARD ID ORIGIN DESTINATION CURRENCY MINIMUM NORMAL +45 KGS +100 KGS +300 KGS +500 KGS +1000 KGS";
const row = (card, d, min = 24900, n = 1245) => `${card} BOM ${d} INR ${min} ${n} 1095 1005 945 885 885`;
const dests = ["ABJ", "ABV", "ACC", "ADB", "ADD", "AGP", "ALA", "ALG", "ALP", "AMM", "AMS", "AQJ"];
const lines = (cards) => [HEAD, ...cards.flatMap((c) => dests.map((d) => row(c, d)))];

// --- the header ---
{
  const h = T.parseHeader(HEAD.split(" "));
  assert.deepEqual(h.kgs, [0, 45, 100, 300, 500, 1000]);
  assert.equal(h.cols[0].kind, "min");
  assert.equal(T.parseHeader("Page 1 of 22".split(" ")), null, "an ordinary line is not a header");
  assert.deepEqual(T.parseHeader("ORIGIN DESTINATION CURRENCY MINIMUM NORMAL +45 FSC".split(" ")), { unsupported: "FSC" }, "an unknown column means the table is refused, never guessed");
  assert.deepEqual(T.parseHeader("ORIGIN DESTINATION CURRENCY MINIMUM NORMAL +150 KGS".split(" ")), { unsupported: "weights" }, "a break we have no column for");
  assert.equal(T.parseHeader("DESTINATION ORIGIN CURRENCY MIN NORMAL".split(" ")), null, "columns in an unexpected order");
}

// --- rate cards become classes ---
{
  assert.equal(T.classFromCardId("BOMGCRTKURGENT", "BOM", "TK"), "GCR");
  assert.equal(T.classFromCardId("BOMDGRTKURGENT", "BOM", "TK"), "DGR");
  assert.equal(T.classFromCardId("BOMDGRCOLTKURGENT", "BOM", "TK"), "DGRCOL");
  assert.equal(T.classFromCardId("BOMSTDPHRCRTTKURGENT", "BOM", "TK"), "STDPHRCRT");
  assert.equal(T.classFromCardId("GENERAL", "BOM", "TK"), "GCR");
  assert.equal(T.classFromCardId("", "BOM", "TK"), "GCR");
  assert.equal(T.titleClass("EY_BLR(DGR)"), "DGR");
  assert.equal(T.titleClass("EY_PHARMA (RANGE15'-25')_BLR"), "PHARMA");
  assert.equal(T.titleClass("EK_MAA"), "GCR");
}

// --- a clean table: every route, every card ---
{
  const r = T.readTable(lines(["BOMGCRTKURGENT", "BOMDGRTKURGENT", "BOMDGRCOLTKURGENT"]), { fallbackCarrier: "tk", validFrom: "2026-06-04", validTo: "2026-12-31" });
  assert.equal(r.ok, true);
  assert.equal(r.rows.length, 36);
  assert.deepEqual(r.rows.map((x) => x.rateClass).filter((c, i, a) => a.indexOf(c) === i), ["GCR", "DGR", "DGRCOL"]);
  assert.deepEqual(r.rows[0], { carrierCode: "TK", origin: "BOM", destination: "ABJ", currency: "INR", breaks: { min: 24900, minus45: 1245, plus45: 1095, plus100: 1005, plus300: 945, plus500: 885, plus1000: 885 }, validFrom: "2026-06-04", validTo: "2026-12-31", rateKind: "unknown", rateClass: "GCR", notes: "" });
  // a header repeated on every page, and page numbers and notes between, change nothing
  const noisy = [];
  for (let i = 0; i < 12; i++) {
    if (i % 4 === 0) noisy.push(HEAD, "Page 1 of 22");
    noisy.push(row("BOMGCRTKURGENT", dests[i]));
  }
  noisy.push("Rates are subject to change without notice.");
  assert.equal(T.readTable(noisy, { fallbackCarrier: "TK" }).rows.length, 12);
  // a single card with no card column takes its class from the title
  const plain = [HEAD.replace("RATE CARD ID ", ""), ...dests.map((d) => `BOM ${d} INR 24900 1245 1095 1005 945 885 885`)];
  assert.equal(T.readTable(plain, { fallbackCarrier: "EY", title: "EY_BLR(DGR)" }).rows[0].rateClass, "DGR");
  assert.equal(T.readTable(plain, { fallbackCarrier: "EY", title: "EY_BLR" }).rows[0].rateClass, "GCR");
}

// --- when it is not clearly a clean table, it declines ---
{
  assert.equal(T.readTable(lines(["BOMGCRTKURGENT"]), { fallbackCarrier: "" }).ok, false, "no airline code");
  assert.equal(T.readTable(lines(["BOMGCRTKURGENT"]).slice(0, 5), { fallbackCarrier: "TK" }).ok, false, "too few routes");
  const l = lines(["BOMGCRTKURGENT"]);
  l[3] = "BOMGCRTKURGENT BOM ADB INR 24040 1172 1002 900 832 764"; // a cell is missing
  const r = T.readTable(l, { fallbackCarrier: "TK" });
  assert.equal(r.ok, false, "one line that does not fit stops the whole table being trusted (1 of 12 is more than 1%)");
  assert.match(r.reason, /did not fit/);
  const big = [HEAD, ...Array.from({ length: 300 }, (_, i) => row("BOMGCRTKURGENT", `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}${String.fromCharCode(65 + Math.floor(i / 676))}`))];
  big[10] = "BOMGCRTKURGENT BOM ADB INR 24040 1172 1002 900 832 764";
  assert.equal(T.readTable(big, { fallbackCarrier: "TK" }).ok, true, "one odd line in 300 is skipped, not applied");
  assert.equal(T.readTable(big, { fallbackCarrier: "TK" }).rows.length, 299);
  assert.equal(T.readTable([HEAD.replace("CURRENCY ", ""), ...dests.map((d) => `BOMGCR BOM ${d} 24900 1245`)], { fallbackCarrier: "TK" }).ok, false, "no currency column");
}

// --- the AI check ---
{
  const table = T.readTable(lines(["BOMGCRTKURGENT", "BOMDGRTKURGENT"]), { fallbackCarrier: "TK" }).rows;
  const same = table.slice(0, 6).map((r) => ({ ...r, rateClass: "WHATEVER" }));
  assert.deepEqual(T.verifySample(table, same), { checked: 6, mismatches: 0, examples: [] }, "the AI may name a card differently; the numbers are what is checked");
  const shifted = table.slice(0, 6).map((r) => ({ ...r, breaks: { ...r.breaks, min: r.breaks.minus45 } }));
  assert.equal(T.verifySample(table, shifted).mismatches, 6);
  const unknownRoute = [{ ...table[0], destination: "ZZZ" }];
  assert.equal(T.verifySample(table, unknownRoute).mismatches, 1);
  assert.equal(T.verifySample(table, [{ ...table[0], currency: "" }]).mismatches, 0, "a page that states no currency is compared on the route");
  assert.deepEqual(T.samplePartIndexes(1), [0]);
  assert.deepEqual(T.samplePartIndexes(2), [0, 1]);
  assert.deepEqual(T.samplePartIndexes(11), [0, 5, 10]);
  assert.deepEqual(T.samplePartIndexes(0), []);
}

console.log("table reader ok");
