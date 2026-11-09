/**
 * Fixed-rules reader for clean tariff tables.
 *
 * Many airline tariffs are plain text tables: a header line (… ORIGIN DESTINATION CURRENCY MINIMUM NORMAL +45 KGS …) and then
 * one line per route. Those are read here with fixed rules: free, exact, and the same answer every time. The AI is not used to
 * read the numbers; it only checks a few pages afterwards (see verifySample), and takes over whenever the layout is not a clean
 * table of this kind. When in doubt this reader declines: it never guesses.
 */
const L = require("./carrier-reader-logic");

const NUM = /^\d[\d,]*(?:\.\d+)?$/;
const CODE3 = /^[A-Z]{3}$/;

/** Text lines of a PDF, in reading order, one string per printed line (cells joined by a space). */
async function pdfTextLines(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // Items on one printed line sit at nearly the same height, but not exactly (a cell can be a point or two off): group by closeness.
    const items = [];
    for (const it of tc.items) {
      const str = String(it.str || "");
      if (str.trim()) items.push({ x: it.transform[4], y: it.transform[5], s: str.trim() });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - it.y) <= 4) last.cells.push(it);
      else rows.push({ y: it.y, cells: [it] });
    }
    for (const r of rows) lines.push(r.cells.sort((a, b) => a.x - b.x).map((c) => c.s).join(" ").replace(/\s+/g, " ").trim());
  }
  return lines;
}

/**
 * A header line -> its rate columns, or null when it is not a header this reader fully understands. A header with any column
 * we do not recognise (a surcharge, a fee) is refused outright: counting columns would then be a guess.
 */
function parseHeader(tokens) {
  const t = tokens.map((x) => x.toUpperCase());
  const iO = t.indexOf("ORIGIN");
  const iD = t.indexOf("DESTINATION");
  const iC = t.indexOf("CURRENCY");
  if (iO < 0 || iD < 0 || iC < 0 || !(iO < iD && iD < iC)) return null;
  const cols = [];
  for (let i = iC + 1; i < t.length; i++) {
    const w = t[i];
    if (w === "MINIMUM" || w === "MIN") cols.push({ kind: "min" });
    else if (["NORMAL", "GENERAL", "GEN"].includes(w)) cols.push({ kind: "rate", kg: 0 });
    else if (/^\+?\d+$/.test(w)) cols.push({ kind: "rate", kg: Number(w.replace("+", "")) });
    else if (/^\+?\d+KGS?$/.test(w)) cols.push({ kind: "rate", kg: Number(w.replace(/[^\d]/g, "")) });
    else if (["KGS", "KG", "/KG", "RATE", "RATES", "PER"].includes(w)) continue;
    else return { unsupported: w };
  }
  const kgs = cols.filter((c) => c.kind === "rate").map((c) => c.kg);
  if (!kgs.length || cols.filter((c) => c.kind === "min").length > 1) return { unsupported: "columns" };
  if (!L.mapThresholds(kgs)) return { unsupported: "weights" };
  return { cols, kgs };
}

/** "BOMDGRCOLTKURGENT" with origin BOM and airline TK -> "DGRCOL": what is left between the origin and the airline code. */
function classFromCardId(id, origin, carrier) {
  let s = String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return "GCR";
  if (origin && s.startsWith(origin)) s = s.slice(origin.length);
  const c = String(carrier || "").toUpperCase();
  const at = c ? s.indexOf(c, 1) : -1;
  if (at > 0) s = s.slice(0, at);
  return L.rateClassOf(s);
}

/** A class named in the file's title ("EY_BLR(DGR)") for a table that has no rate-card column of its own. */
function titleClass(title) {
  const m = String(title || "").toUpperCase().match(/(?<![A-Z0-9])(DGR|PHARMA|PHR|PRIORITY|VALUABLE|PERISHABLE|AOG)(?![A-Z0-9])/);
  return m ? (m[1] === "PHR" ? "PHARMA" : m[1]) : "GCR";
}

/**
 * Lines of text -> rows, or { ok:false, reason }.
 * Accepted only when it is clearly a clean table: at least 10 routes, and nothing that looks like a route line fails to fit the
 * header it sits under.
 */
function readTable(lines, { fallbackCarrier = "", title = "", validFrom = "", validTo = "" } = {}) {
  const carrier = String(fallbackCarrier || "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(carrier)) return { ok: false, reason: "the airline code is not known" };
  let spec = null;
  const raw = [];
  let bad = 0;
  const badSamples = [];
  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const h = parseHeader(tokens);
    if (h) {
      if (h.unsupported) return { ok: false, reason: `the table has a column this reader does not handle (${h.unsupported})` };
      spec = h;
      continue;
    }
    if (!spec) continue;
    const numeric = tokens.filter((x) => NUM.test(x)).length;
    if (numeric < 3) continue; // a title, a note, a page number
    const k = spec.cols.length;
    const tail = tokens.slice(-k);
    const lead = tokens.slice(0, -k);
    const okRow = tokens.length > k && tail.every((x) => NUM.test(x)) && lead.length >= 3 && CODE3.test(lead[lead.length - 1]) && CODE3.test(lead[lead.length - 2]) && CODE3.test(lead[lead.length - 3]);
    if (!okRow) {
      bad += 1;
      if (badSamples.length < 3) badSamples.push(line.slice(0, 80));
      continue;
    }
    const [origin, destination, currency] = lead.slice(-3);
    const card = lead.slice(0, -3).join("");
    const breaks = {};
    const slots = L.mapThresholds(spec.kgs);
    let ri = 0;
    spec.cols.forEach((col, i) => {
      const n = L.toNumber(tail[i]);
      if (col.kind === "min") breaks.min = n;
      else breaks[slots[ri++]] = n;
    });
    raw.push({ carrierCode: carrier, origin, destination, currency, breaks, validFrom, validTo, rateKind: "unknown", rateClass: card ? classFromCardId(card, origin, carrier) : titleClass(title), card });
  }
  if (raw.length < 10) return { ok: false, reason: "too few table lines were found" };
  if (bad > 0 && bad / (bad + raw.length) > 0.01) return { ok: false, reason: `${bad} lines did not fit the table (e.g. "${badSamples[0] || ""}")` };
  return { ok: true, rows: L.normalizeRows(raw, carrier), lines: raw.length, skipped: bad };
}

/** "Effective 12 Jul to 30 Sep 2026" -> { validFrom, validTo } (YYYY-MM-DD), or empty strings when the lines carry no such sentence. */
function effectiveDates(lines) {
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  for (const raw of lines.slice(0, 40)) {
    // Letter-spaced titles split numbers (like 1 2 Jul): rejoin single digits.
    const line = raw.replace(/\b(\d) (?=\d\b)/g, "$1");
    const m = /effective\s+(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(?:(\d{4})\s+)?(?:to|-|until)\s+(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/i.exec(line);
    if (!m) continue;
    const m1 = MON[m[2].toLowerCase()];
    const m2 = MON[m[5].toLowerCase()];
    if (!m1 || !m2) continue;
    const y2 = Number(m[6]);
    const y1 = m[3] ? Number(m[3]) : m1 > m2 ? y2 - 1 : y2;
    const p = (n) => String(n).padStart(2, "0");
    return { validFrom: `${y1}-${p(m1)}-${p(Number(m[1]))}`, validTo: `${y2}-${p(m2)}-${p(Number(m[4]))}` };
  }
  return { validFrom: "", validTo: "" };
}

/** A section header of the "Dest. Region Amount N +45 ..." kind, or null. Seven bare "Dest." cells are the same table with its labels lost. */
function parseSectionHeader(tokens) {
  const t = tokens.map((x) => x.toUpperCase());
  if (t.length >= 6 && t.every((x) => x === "DEST." || x === "DEST")) {
    return t.length === 7 ? { cols: [{ kind: "min" }, { kind: "rate", kg: 0 }, { kind: "rate", kg: 45 }, { kind: "rate", kg: 100 }, { kind: "rate", kg: 300 }, { kind: "rate", kg: 500 }], kgs: [0, 45, 100, 300, 500], hasOrigin: false } : { unsupported: "dest cells" };
  }
  const iA = t.indexOf("AMOUNT");
  const iD = t.findIndex((x) => x === "DEST." || x === "DEST");
  if (iA < 0 || iD < 0 || !t.includes("REGION") || iD > iA) return null;
  const cols = [{ kind: "min" }];
  for (const w of t.slice(iA + 1)) {
    if (w === "N" || w === "NORMAL") cols.push({ kind: "rate", kg: 0 });
    else if (/^\+\d+$/.test(w)) cols.push({ kind: "rate", kg: Number(w.slice(1)) });
    else return { unsupported: w };
  }
  const kgs = cols.filter((c) => c.kind === "rate").map((c) => c.kg);
  if (!kgs.length || !L.mapThresholds(kgs)) return { unsupported: "weights" };
  return { cols, kgs, hasOrigin: iD > 0 && t[0].startsWith("ORIG") };
}

/** A class heading line ("GCR", "AXS-COL / DG PAX / AXM", "GC R/ O ffline") -> the classes it names. "Offline" only says these are offline stations. */
function sectionClasses(line) {
  // A heading is a short run of letters; a blank line, a page number or a line of figures is not one.
  if (!/[A-Za-z]/.test(line) || /\d{3}|,/.test(line) || String(line).length > 60) return [];
  const parts = String(line || "").split("/").map((x) => L.rateClassOf(x.replace(/\s+/g, "")));
  return [...new Set(parts.filter((c) => c && c !== "OFFLINE" && c !== "ONLINE"))];
}

/**
 * The other common layout: sections, each headed by its rate class(es) on the line above a "Dest. Region Amount N +45 ..." header,
 * with the origin in the file's title and no currency printed. The origin and currency are given by the caller (the currency is
 * the company default when the file prints none). Declines on anything it does not recognise, like readTable.
 */
function readSectionTable(lines, { fallbackCarrier = "", origin = "", currency = "", validFrom = "", validTo = "" } = {}) {
  const carrier = String(fallbackCarrier || "").toUpperCase();
  const from = String(origin || "").toUpperCase();
  const cur = String(currency || "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(carrier)) return { ok: false, reason: "the airline code is not known" };
  if (!CODE3.test(from)) return { ok: false, reason: "the origin station is not known" };
  if (!CODE3.test(cur)) return { ok: false, reason: "the currency is not known" };
  const dates = !validFrom && !validTo ? effectiveDates(lines) : { validFrom, validTo };
  let spec = null;
  let classes = [];
  let prev = "";
  let sections = 0;
  let bad = 0;
  const badSamples = [];
  const raw = [];
  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const h = parseSectionHeader(tokens);
    if (h) {
      if (h.unsupported) return { ok: false, reason: `a table header this reader does not handle (${h.unsupported})` };
      const cls = sectionClasses(prev);
      if (!cls.length) return { ok: false, reason: "a table has no rate class heading above it" };
      spec = h;
      classes = cls;
      sections += 1;
      continue;
    }
    prev = line;
    if (!spec) continue;
    const k = spec.cols.length;
    const numeric = tokens.filter((x) => NUM.test(x)).length;
    if (numeric < 2) continue;
    const tail = tokens.slice(-k);
    let lead = tokens.slice(0, -k);
    if (spec.hasOrigin && lead.length && /^[A-Z]{2}$/.test(lead[0])) lead = lead.slice(1);
    const okRow = tokens.length > k && tail.every((x) => NUM.test(x)) && lead.length >= 1 && CODE3.test(lead[0]) && lead.slice(1).every((x) => !NUM.test(x));
    if (!okRow) {
      // A heading line has no numbers; a line that starts like a route and has figures but does not fit the table is a problem.
      if (numeric >= 3 || (numeric >= 1 && CODE3.test(tokens[0]))) {
        bad += 1;
        if (badSamples.length < 3) badSamples.push(line.slice(0, 80));
      }
      continue;
    }
    const breaks = {};
    const slots = L.mapThresholds(spec.kgs);
    let ri = 0;
    spec.cols.forEach((col, i) => {
      const n = L.toNumber(tail[i]);
      if (col.kind === "min") breaks.min = n;
      else breaks[slots[ri++]] = n;
    });
    for (const rateClass of classes) raw.push({ carrierCode: carrier, origin: from, destination: lead[0], currency: cur, breaks, validFrom: dates.validFrom, validTo: dates.validTo, rateKind: "unknown", rateClass });
  }
  if (sections < 1 || raw.length < 10) return { ok: false, reason: "too few table lines were found" };
  if (bad > 0 && bad / (bad + raw.length) > 0.01) return { ok: false, reason: `${bad} lines did not fit the table (e.g. "${badSamples[0] || ""}")` };
  return { ok: true, rows: L.normalizeRows(raw, carrier), lines: raw.length, skipped: bad, sections };
}

const sameBreaks = (a, b) => ["min", "minus45", "plus45", "plus100", "plus300", "plus500", "plus1000"].every((k) => {
  const x = a && a[k] != null ? Number(a[k]) : null;
  const y = b && b[k] != null ? Number(b[k]) : null;
  return x === y || (x !== null && y !== null && Math.abs(x - y) < 1e-9);
});

/**
 * The AI read a few pages as a check. Every route it gave must appear in the table read with exactly the same numbers
 * (on any rate card: the AI may name a card differently, the numbers cannot differ). Returns how many it checked and how many
 * did not match. A table read that is wrong in structure (shifted columns) fails nearly every row.
 */
function verifySample(tableRows, aiRows) {
  const byRoute = new Map();
  for (const r of tableRows) {
    const k = `${r.origin}|${r.destination}|${r.currency}`;
    if (!byRoute.has(k)) byRoute.set(k, []);
    byRoute.get(k).push(r);
  }
  let mismatches = 0;
  const examples = [];
  for (const a of aiRows) {
    // An AI row with no currency (the page did not state one) is compared on the route alone.
    const mine = a.currency ? byRoute.get(`${a.origin}|${a.destination}|${a.currency}`) || [] : tableRows.filter((r) => r.origin === a.origin && r.destination === a.destination);
    if (!mine.some((r) => sameBreaks(r.breaks, a.breaks))) {
      mismatches += 1;
      if (examples.length < 3) examples.push(`${a.origin}→${a.destination}`);
    }
  }
  return { checked: aiRows.length, mismatches, examples };
}

/** Which of n parts to have the AI check: the first, the middle and the last. */
function samplePartIndexes(n) {
  if (n <= 0) return [];
  return [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
}

module.exports = { pdfTextLines, parseHeader, parseSectionHeader, sectionClasses, effectiveDates, readSectionTable, classFromCardId, titleClass, readTable, verifySample, samplePartIndexes };
