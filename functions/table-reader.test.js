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
  assert.deepEqual(r.rows[0], { carrierCode: "TK", origin: "BOM", destination: "ABJ", currency: "INR", breaks: { min: 24900, minus45: 1245, plus45: 1095, plus100: 1005, plus250: null, plus300: 945, plus500: 885, plus1000: 885 }, validFrom: "2026-06-04", validTo: "2026-12-31", rateKind: "unknown", rateClass: "GCR", notes: "" });
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

// --- a heading taken for an origin does not fail the check when the numbers agree ---
{
  const rows = T.readTable(lines(["BOMGCRTKURGENT"]), { fallbackCarrier: "TK" }).rows;
  const confused = rows.slice(0, 6).map((r) => ({ ...r, origin: "AXA" }));
  assert.equal(T.verifySample(rows, confused).mismatches, 0, "one origin in the file: the AI's origin is not what is checked");
  const wrongNumbers = confused.map((r) => ({ ...r, breaks: { ...r.breaks, min: 1 } }));
  assert.equal(T.verifySample(rows, wrongNumbers).mismatches, 6, "but the numbers still must match");
  // with several origins in one file the origin does matter
  const two = [...rows.slice(0, 6), ...rows.slice(0, 6).map((r) => ({ ...r, origin: "DEL" }))];
  assert.equal(T.verifySample(two, [{ ...rows[0], origin: "AXA" }]).mismatches, 1);
}

// --- more EK layouts: numbered headings, no Region column, labels wrapped onto their own lines ---
{
  const opt = { fallbackCarrier: "EK", origin: "MAA", currency: "INR" };
  assert.deepEqual(T.sectionClasses("1. GCR"), ["GCR"]);
  assert.deepEqual(T.sectionClasses("2. AXS - CRT / VUN"), ["AXSCRT", "VUN"]);
  assert.deepEqual(T.sectionClasses("11. GCR - Offline Tariff"), ["GCR"], "words like Offline and Tariff are not part of the class");
  assert.deepEqual(T.sectionClasses("OFFLINE"), []);
  assert.deepEqual(T.sectionClasses("DEST"), []);
  assert.deepEqual(T.sectionClasses("MAA STANDARD T ARIFF"), [], "a title is not a heading");
  assert.deepEqual(T.sectionClasses("Effective 1 2 Jul to 3 0 Sep 2026"), []);
  const noRegion = ["GCR", "Dest. Amount N +45 +100 +300 +500", ...dests.map((d) => `${d} 18,800.00 940.00 850.00 775.00 730.00 590.00`), "DG PAX", "Dest. Amount N +45 +100 +300 +500", ...dests.map((d) => `${d} 20,700.00 1,035.00 935.00 855.00 805.00 650.00`)];
  const r = T.readSectionTable(noRegion, opt);
  assert.deepEqual([r.ok, r.rows.length, r.rows[0].breaks.min, r.rows[12].rateClass, r.rows[12].breaks.minus45], [true, 24, 18800, "DGPAX", 1035], "decimals and thousands separators");
  const wrapped = ["11. GCR - Offline Tariff", "OFFLINE", "Amount N 45 100 300 500", "DEST", ...dests.map((d) => `${d} 13,200 590 475 430 355 250`)];
  const w = T.readSectionTable(wrapped, opt);
  assert.deepEqual([w.ok, w.rows.length, w.rows[0].rateClass, w.rows[0].breaks.plus500], [true, 12, "GCR", 250], "a header split over separate lines");
}


// --- the list layout: "DESTINATION Min N 45 100 250", region headings, blank-lead offline tables ---
{
  const online = ["ATL", "BOS", "CLT", "IAD", "ORD", "JFK", "AMS", "ATH", "BCN", "BRU", "CDG", "CPH"].map((c) => `${c} 16028 752 673 605 542`);
  const sheet = [
    "Dear Customers ,",
    "Please find Net Net Rates for GCR shipments below 500 kgs Break Point . Rate valid for shipments booked",
    "from 12 th Jul 202 6 . Other surcharges such as MSC and local char ges will be additional.",
    "Rates quoted in INR. Rates subject to space.",
    "DESTINATION Min N 45 100 250",
    "USA ONLINE",
    ...online.slice(0, 6),
    "EUROPE ONLINE",
    ...online.slice(6),
    "USA OFFLINE",
    "AUS 830 699 636",
    "BHM 865 691 610",
    "EUROPE ONLINE",
    "VIE 9863 425 380 335 298",
    "2",
  ];
  const r = T.readListTable(sheet, { fallbackCarrier: "ey", origin: "BLR", rateClass: "GCR", currency: "INR" });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.rows.length, 15);
  assert.equal(r.offlineRows, 2);
  assert.deepEqual(r.rows[0], { carrierCode: "EY", origin: "BLR", destination: "ATL", currency: "INR", breaks: { min: 16028, minus45: 752, plus45: 673, plus100: 605, plus250: 542, plus300: null, plus500: null, plus1000: null }, validFrom: "2026-07-12", validTo: "", rateKind: "unknown", rateClass: "GCR", notes: "" });
  const aus = r.rows.find((x) => x.destination === "AUS");
  assert.deepEqual([aus.breaks.min, aus.breaks.minus45, aus.breaks.plus45, aus.breaks.plus100, aus.breaks.plus250], [null, null, 830, 699, 636], "offline: only the last three columns are printed");
  assert.equal(r.rows.find((x) => x.destination === "VIE").breaks.min, 9863, "an ONLINE heading after an OFFLINE one switches back to full rows");
  // a three-figure row outside an OFFLINE table is a problem, never a guess
  const wrong = T.readListTable([...sheet.slice(0, 5), ...online, "AUS 830 699 636", "BHM 865 691 610"], { fallbackCarrier: "ey", origin: "BLR", currency: "INR" });
  assert.equal(wrong.ok, false);
  // class and origin come from the caller; no origin, no read
  assert.equal(T.readListTable(sheet, { fallbackCarrier: "ey", origin: "", currency: "INR" }).ok, false);
  assert.equal(T.readListTable(sheet.slice(5), { fallbackCarrier: "ey", origin: "BLR", currency: "INR" }).ok, false, "no header, no read");
  // a stated currency wins over the default
  assert.equal(T.readListTable(sheet.map((l) => l.replace("quoted in INR", "quoted in USD")), { fallbackCarrier: "ey", origin: "BLR", currency: "INR" }).rows[0].currency, "USD");
  // a header column this reader does not know declines the whole table
  assert.equal(T.readListTable(sheet.map((l) => l.replace("DESTINATION Min N 45 100 250", "DESTINATION Min N 45 100 275")), { fallbackCarrier: "ey", origin: "BLR", currency: "INR" }).ok, false);
  assert.equal(T.parseListHeader(["DESTINATION", "Min", "N", "45", "100", "250"]).kgs.join(","), "0,45,100,250");
}


// --- grouped commodity blocks (Sharaf/WY style): destinations in a tall cell, a row per commodity ---
{
  const sheet = [
    "Standard Tariff for BOM",
    "Effective 01st Nov '26 - 31st Mar '27",
    "Destination Commodity Min Normal +45 +100 +250",
    "Middle East",
    "GCR 7000 295 250 240 235",
    "XPS 9100 384 325 312 310",
    "MCT/AMM/BAH/CAI/ DGR - PAX 7700 325 275 264 259",
    "DMM/DXB/JED/KWI/RUH/SLL COL ( 2 to 8 degree) 9100 384 325 312 310",
    "CRT(15 to 25 degree) 8400 354 300 288 282",
    "VAL 35000",
    "Asia",
    "GCR 5760 288 248 240 235",
    "XPS 7488 374 322 312 306",
    "DGR - PAX - - - - -",
    "DAC",
    "COL ( 2 to 8 degree) - - - - -",
    "CRT(15 to 25 degree) 6912 346 298 288 282",
    "Europe",
    "CDG/FRA/IST/LHR/MUC/ GCR 6500 335 320 320 310",
    "MXP/FCO/AMS XPS 9750 518 503 495 480",
    "DGR - PAX 7150 380 369 363 352",
    "COL ( 2 to 8 degree) 9750 518 503 495 480",
    "CRT(15 to 25 degree) 8125 431 419 413 400",
    "VAL 15000 658",
    "Russia",
    "GCR 10000 500 350 330 320",
    "XPS 12000 675 600 525 500",
    "DGR - PAX 12000 675 600 525 500",
    "SVO II COL ( 2 to 8 degree) 12000 675 600 525 500",
    "CRT(15 to 25 degree) 12000 625",
    "550 475 450",
    "VAL 60000",
    "Far East",
    "GCR 6860 343 303 210 205",
    "XPS 8918 446 394 273 267",
    "DGR - PAX 7546 377 333 231 226",
    "CGK",
    "COL ( 2 to 8 degree) 8918 446 394 273 267",
    "CRT(15 to 25 degree) 8232 412 364 252 246",
    "VAL 12390 470",
    "GCR 3560 328 288 210 205",
    "MNL/SIN",
    "XPS 4654 426 374.4 273 266.5",
    "VAL 12390 470",
    "Africa",
    "DAR",
    "CHECK WITH SALES FOR RATES AND SPACE",
    "ZNZ",
    "General Information",
    "Cut Off Time for Products GCR COU/PER/XPS- Smalls/Val XPS - Heavy /Big lots",
  ];
  const r = T.readCommodityTable(sheet, { fallbackCarrier: "wy", origin: "BOM", currency: "INR" });
  assert.equal(r.ok, true, r.reason);
  const row = (d, c) => r.rows.find((x) => x.destination === d && x.rateClass === c);
  assert.deepEqual(row("MCT", "GCR").breaks, { min: 7000, minus45: 295, plus45: 250, plus100: 240, plus250: 235, plus300: null, plus500: null, plus1000: null });
  assert.equal(row("SLL", "COL").breaks.plus250, 310, "a destination in the second half of the cell list");
  assert.equal(row("MXP", "XPS").breaks.min, 9750, "destinations split over several lines belong to the same block");
  assert.equal(row("SVO", "CRT").breaks.plus45, 550, "a wrapped row joins its figures");
  assert.equal(row("MNL", "XPS").breaks.plus45, 374.4);
  assert.equal(row("SIN", "XPS").breaks.plus250, 266.5);
  assert.equal(row("DAC", "DGR"), undefined, "dashes mean no rate");
  assert.equal(row("DAC", "COL"), undefined);
  assert.deepEqual([row("FRA", "VAL").breaks.min, row("FRA", "VAL").breaks.minus45, row("FRA", "VAL").breaks.plus45], [15000, 658, null]);
  assert.equal(row("MCT", "VAL").breaks.minus45, null, "a VAL row with only a minimum");
  assert.equal(row("DAR", "GCR"), undefined, "no rates for Africa");
  assert.equal(r.rows[0].validFrom, "2026-11-01");
  assert.equal(r.rows[0].validTo, "2027-03-31");
  assert.equal(new Set(r.rows.map((x) => x.rateClass)).size, 6);
  // a commodity row that does not fit declines the whole table
  assert.equal(T.readCommodityTable(sheet.map((l) => l.replace("XPS 9100 384 325 312 310", "XPS 9100 384 325 312")), { fallbackCarrier: "wy", origin: "BOM", currency: "INR" }).ok, false);
  assert.equal(T.readCommodityTable(sheet, { fallbackCarrier: "wy", origin: "", currency: "INR" }).ok, false);
  assert.deepEqual(T.effectiveShort(["Effective 01st Nov '26 - 31st Mar '27"]), { validFrom: "2026-11-01", validTo: "2027-03-31" });
}

console.log("table reader ok");

// --- sections: the rate class is a heading above each table, the origin is in the title, no currency is printed ---
{
  const secHead = "Dest. Region Amount N +45 +100 +300 +500";
  const sec = (cls, tag) => [cls, secHead, ...dests.map((d, i) => `${d} Africa 8,600 ${430 + i} ${400 + i} 370 360 ${350 + i}`)];
  const lines2 = ["AMD STANDARD T ARIFF", "Effective 1 2 Jul to 3 0 Sep 2026", ...sec("GCR"), ...sec("AXS-COL / DG PAX / AXM"), "GC R/ O ffline", "Dest. Dest. Dest. Dest. Dest. Dest. Dest.", ...dests.map((d) => `${d} 13,200 590 475 430 355 250`)];
  const r = T.readSectionTable(lines2, { fallbackCarrier: "ek", origin: "amd", currency: "INR" });
  assert.equal(r.ok, true);
  assert.equal(r.sections, 3);
  assert.deepEqual([...new Set(r.rows.map((x) => x.rateClass))], ["GCR", "AXSCOL", "DGPAX", "AXM"], "one heading can name several classes; Offline only describes the stations");
  assert.equal(r.rows.length, 12 + 36 + 12, "a shared table is one row per class; the offline table is general cargo");
  assert.deepEqual(r.rows[0], { carrierCode: "EK", origin: "AMD", destination: "ABJ", currency: "INR", breaks: { min: 8600, minus45: 430, plus45: 400, plus100: 370, plus250: null, plus300: 360, plus500: 350, plus1000: null }, validFrom: "2026-07-12", validTo: "2026-09-30", rateKind: "unknown", rateClass: "GCR", notes: "" });
  const offline = r.rows.filter((x) => x.rateClass === "GCR").slice(-1)[0];
  assert.deepEqual([offline.breaks.min, offline.breaks.minus45, offline.breaks.plus500], [13200, 590, 250], "offline rows read the same six columns");
  // a two-column table (Amount and N only) and the country-coded one
  const two = ["HUM", "Dest. Region Amount N", ...dests.map((d) => `${d} Africa 8,600 430`)];
  const r2 = T.readSectionTable([...lines2.slice(0, 2), ...two], { fallbackCarrier: "EK", origin: "AMD", currency: "INR" });
  assert.deepEqual([r2.ok, r2.rows[0].rateClass, r2.rows[0].breaks.min, r2.rows[0].breaks.minus45, r2.rows[0].breaks.plus45], [true, "HUM", 8600, 430, null]);
  const val = ["VAL", "Orig. Dest. Region Amount N", ...dests.map((d) => `IN ${d} Africa 17,200 800`)];
  assert.equal(T.readSectionTable(val, { fallbackCarrier: "EK", origin: "AMD", currency: "INR" }).rows[0].destination, "ABJ");
  // dates
  assert.deepEqual(T.effectiveDates(["Effective 1 Oct to 31 Dec 2026"]), { validFrom: "2026-10-01", validTo: "2026-12-31" });
  assert.deepEqual(T.effectiveDates(["Effective 15 Dec to 15 Jan 2027"]), { validFrom: "2026-12-15", validTo: "2027-01-15" }, "across a year end");
  assert.deepEqual(T.effectiveDates(["Nothing here"]), { validFrom: "", validTo: "" });
  // declines
  assert.equal(T.readSectionTable(lines2, { fallbackCarrier: "EK", origin: "", currency: "INR" }).ok, false, "no origin station");
  assert.equal(T.readSectionTable(lines2, { fallbackCarrier: "EK", origin: "AMD", currency: "" }).ok, false, "no currency");
  assert.equal(T.readSectionTable([secHead, ...dests.map((d) => `${d} Africa 8,600 430 400 370 360 350`)], { fallbackCarrier: "EK", origin: "AMD", currency: "INR" }).ok, false, "a table with no class heading above it");
  assert.equal(T.readSectionTable(["GCR", "Dest. Region Amount N +45 FSC", ...dests.map((d) => `${d} Africa 8,600 430 400 1`)], { fallbackCarrier: "EK", origin: "AMD", currency: "INR" }).ok, false, "an unknown column");
  const broken = [...lines2];
  broken[5] = "ADD Africa 8,600 430"; // a cell is missing
  assert.equal(T.readSectionTable(broken, { fallbackCarrier: "EK", origin: "AMD", currency: "INR" }).ok, false, "a line that does not fit the table stops it being trusted");
}
