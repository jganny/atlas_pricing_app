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
  if (iA < 0) return null;
  const iD = t.findIndex((x) => x === "DEST." || x === "DEST");
  // Either "Dest. [Region] Amount N +45 ..." or, when the labels wrapped onto separate lines, just "Amount N 45 100 ...".
  if (iD >= 0 ? iD > iA : iA !== 0) return null;
  const cols = [{ kind: "min" }];
  for (const w of t.slice(iA + 1)) {
    if (w === "N" || w === "NORMAL") cols.push({ kind: "rate", kg: 0 });
    else if (/^\+?\d+$/.test(w)) cols.push({ kind: "rate", kg: Number(w.replace("+", "")) });
    else return { unsupported: w };
  }
  if (cols.length < 2) return null;
  const kgs = cols.filter((c) => c.kind === "rate").map((c) => c.kg);
  if (!kgs.length || !L.mapThresholds(kgs)) return { unsupported: "weights" };
  return { cols, kgs, hasOrigin: iD > 0 && t[0].startsWith("ORIG") };
}

/** A class heading line ("GCR", "AXS-COL / DG PAX / AXM", "GC R/ O ffline") -> the classes it names. "Offline" only says these are offline stations. */
function sectionClasses(line) {
  const l = String(line || "");
  // A heading is a short run of letters; a blank line, a page number, a title or a line of figures is not one.
  if (!/[A-Za-z]/.test(l) || /\d{3}|,/.test(l) || l.length > 50) return [];
  const cleaned = l.replace(/^\s*\d+\.\s*/, "").replace(/\b(offline|online|tariff|rates?|dest\.?)\b/gi, " ").trim();
  if (!cleaned || cleaned.split(/\s+/).length > 12) return [];
  const out = [];
  for (const part of cleaned.split("/")) {
    const raw = part.replace(/[^A-Za-z0-9]/g, "");
    if (!raw || raw.length > 10) return []; // a long run of letters is a title, not a class
    out.push(L.rateClassOf(raw));
  }
  // "Offline" only says these are offline stations; it is not a rate class.
  return [...new Set(out)].filter((c) => c !== "OFFLINE" && c !== "ONLINE");
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
  let heading = [];
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
      if (!heading.length) return { ok: false, reason: "a table has no rate class heading above it" };
      spec = h;
      classes = heading;
      sections += 1;
      continue;
    }
    const named = sectionClasses(line);
    if (named.length) heading = named;
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

/** A list-table header: "DESTINATION Min N 45 100 250" (no origin, currency or amount column), or null. */
function parseListHeader(tokens) {
  const t = tokens.map((x) => x.toUpperCase());
  if (!(t[0] === "DESTINATION" || t[0] === "DEST." || t[0] === "DEST")) return null;
  if (t.length < 4 || !(t[1] === "MIN" || t[1] === "MINIMUM")) return null;
  const cols = [{ kind: "min" }];
  for (const w of t.slice(2)) {
    if (w === "N" || w === "NORMAL" || w === "GENERAL") cols.push({ kind: "rate", kg: 0 });
    else if (/^\+?\d+$/.test(w)) cols.push({ kind: "rate", kg: Number(w.replace("+", "")) });
    else return { unsupported: w };
  }
  const kgs = cols.filter((c) => c.kind === "rate").map((c) => c.kg);
  if (!kgs.length || !L.mapThresholds(kgs)) return { unsupported: "weights" };
  return { cols, kgs };
}

/** "from 12 th Jul 202 6" (letter-spaced) -> "2026-07-12", or "". */
function bookedFromDate(lines) {
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  for (const raw of lines.slice(0, 15)) {
    const line = raw.replace(/(\d) (?=\d)/g, "$1");
    const m = /(?:booked\s+)?from\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/i.exec(line);
    if (!m || !MON[m[2].toLowerCase()]) continue;
    const p = (n) => String(n).padStart(2, "0");
    return `${m[3]}-${p(MON[m[2].toLowerCase()])}-${p(Number(m[1]))}`;
  }
  return "";
}

/** "Rates quoted in INR" -> "INR", or "". */
function statedCurrency(lines) {
  for (const line of lines.slice(0, 20)) {
    const m = /rates?\s+(?:are\s+)?quoted\s+in\s+([A-Z]{3})\b/i.exec(line);
    if (m) return m[1].toUpperCase();
  }
  return "";
}

/**
 * The simplest layout: one table, "DESTINATION Min N 45 100 250", region headings (USA ONLINE, EUROPE ONLINE...) and one line per
 * destination. The origin and rate class come from the file's title, the currency from "Rates quoted in INR" (or the company
 * default). Declines on anything it does not recognise, like the other readers.
 */
function readListTable(lines, { fallbackCarrier = "", origin = "", rateClass = "GCR", currency = "", validFrom = "", validTo = "" } = {}) {
  const carrier = String(fallbackCarrier || "").toUpperCase();
  const from = String(origin || "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(carrier)) return { ok: false, reason: "the airline code is not known" };
  if (!CODE3.test(from)) return { ok: false, reason: "the origin station is not known" };
  const cur = statedCurrency(lines) || String(currency || "").toUpperCase();
  if (!CODE3.test(cur)) return { ok: false, reason: "the currency is not known" };
  const dateFrom = validFrom || bookedFromDate(lines);
  let spec = null;
  let bad = 0;
  let offline = false;
  let offlineRows = 0;
  const badSamples = [];
  const raw = [];
  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const h = parseListHeader(tokens);
    if (h) {
      if (h.unsupported) return { ok: false, reason: `a table header this reader does not handle (${h.unsupported})` };
      spec = h;
      offline = false;
      continue;
    }
    if (!spec) continue;
    const k = spec.cols.length;
    const numeric = tokens.filter((x) => NUM.test(x)).length;
    if (numeric < 2) {
      // A heading (USA ONLINE, EUROPE OFFLINE...). The offline tables of the airline leave the first columns blank.
      if (numeric === 0 && /[A-Za-z]/.test(line)) offline = /\bOFFLINE\b/i.test(line);
      continue;
    }
    const full = tokens.length === k + 1 && CODE3.test(tokens[0]) && tokens.slice(1).every((x) => NUM.test(x));
    // Offline stations: the printed table has empty Min and Normal cells, so the text holds only the last three figures.
    const blankLead = offline && k === 5 && tokens.length === 4 && CODE3.test(tokens[0]) && tokens.slice(1).every((x) => NUM.test(x));
    if (!full && !blankLead) {
      if (numeric >= 3) {
        bad += 1;
        if (badSamples.length < 3) badSamples.push(line.slice(0, 80));
      }
      continue;
    }
    const figures = blankLead ? [null, null, ...tokens.slice(1)] : tokens.slice(1);
    if (blankLead) offlineRows += 1;
    const breaks = {};
    const slots = L.mapThresholds(spec.kgs);
    let ri = 0;
    spec.cols.forEach((col, i) => {
      const n = figures[i] === null ? null : L.toNumber(figures[i]);
      if (col.kind === "min") breaks.min = n;
      else breaks[slots[ri++]] = n;
    });
    raw.push({ carrierCode: carrier, origin: from, destination: tokens[0], currency: cur, breaks, validFrom: dateFrom, validTo, rateKind: "unknown", rateClass });
  }
  if (raw.length < 10) return { ok: false, reason: "too few table lines were found" };
  if (bad > 0 && bad / (bad + raw.length) > 0.01) return { ok: false, reason: `${bad} lines did not fit the table (e.g. "${badSamples[0] || ""}")` };
  return { ok: true, rows: L.normalizeRows(raw, carrier), lines: raw.length, skipped: bad, offlineRows };
}

/** "Effective 01st Nov '26 - 31st Mar '27" -> { validFrom, validTo }, or empty strings. */
function effectiveShort(lines) {
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  for (const line of lines.slice(0, 12)) {
    const m = /effective\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?\s*'?(\d{2,4})\s*(?:-|to|until)\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?\s*'?(\d{2,4})/i.exec(line);
    if (!m || !MON[m[2].toLowerCase()] || !MON[m[5].toLowerCase()]) continue;
    const yr = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));
    const p = (n) => String(n).padStart(2, "0");
    return { validFrom: `${yr(m[3])}-${p(MON[m[2].toLowerCase()])}-${p(Number(m[1]))}`, validTo: `${yr(m[6])}-${p(MON[m[5].toLowerCase()])}-${p(Number(m[4]))}` };
  }
  return { validFrom: "", validTo: "" };
}

/** "Destination Commodity Min Normal +45 +100 +250" -> columns, or null. */
function parseCommodityHeader(tokens) {
  const t = tokens.map((x) => x.toUpperCase());
  if (t[0] !== "DESTINATION" || t[1] !== "COMMODITY" || !(t[2] === "MIN" || t[2] === "MINIMUM")) return null;
  const cols = [{ kind: "min" }];
  for (const w of t.slice(3)) {
    if (w === "N" || w === "NORMAL" || w === "GENERAL") cols.push({ kind: "rate", kg: 0 });
    else if (/^\+?\d+$/.test(w)) cols.push({ kind: "rate", kg: Number(w.replace("+", "")) });
    else return { unsupported: w };
  }
  const kgs = cols.filter((c) => c.kind === "rate").map((c) => c.kg);
  if (!kgs.length || !L.mapThresholds(kgs)) return { unsupported: "weights" };
  return { cols, kgs };
}

const COMMODITY = /(GCR|XPS|DGR\s*-\s*PAX|COL\s*\([^)]*\)|CRT\s*\([^)]*\)|VAL)(?![A-Za-z])/;
const commodityClass = (c) => (/^DGR/.test(c) ? "DGR" : /^COL/.test(c) ? "COL" : /^CRT/.test(c) ? "CRT" : c);
const isDestFragment = (line) => /^[A-Z]{3}(?:\s*II)?(?:\s*\/\s*[A-Z]{3}(?:\s*II)?)*\/?$/.test(line.trim());

/**
 * A grouped commodity table: one block per destination (or list of destinations, "MCT/AMM/BAH/..."), a row per commodity
 * (GCR, XPS, DGR - PAX, COL, CRT, VAL) under "Destination Commodity Min Normal +45 +100 +250". The destinations sit in a tall cell
 * beside the rows, so in the text they appear on any line of their block. A block starts at its GCR row and ends at VAL, the next
 * region heading or the next GCR row. "-" means no rate. Declines on any commodity row that does not fit.
 */
function readCommodityTable(lines, { fallbackCarrier = "", origin = "", currency = "", validFrom = "", validTo = "" } = {}) {
  const carrier = String(fallbackCarrier || "").toUpperCase();
  const from = String(origin || "").toUpperCase();
  const cur = String(currency || "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}$/.test(carrier)) return { ok: false, reason: "the airline code is not known" };
  if (!CODE3.test(from)) return { ok: false, reason: "the origin station is not known" };
  if (!CODE3.test(cur)) return { ok: false, reason: "the currency is not known" };
  const dates = validFrom || validTo ? { validFrom, validTo } : effectiveShort(lines);
  let spec = null;
  let group = null; // { dests: [], rows: [] }
  let pending = []; // destinations seen while no block is open
  const out = [];
  const problems = [];
  let blocks = 0;
  const close = () => {
    if (group) {
      if (group.rows.length) {
        if (!group.dests.length) problems.push("a block of rates has no destination");
        for (const d of group.dests) for (const r of group.rows) out.push({ carrierCode: carrier, origin: from, destination: d, currency: cur, breaks: r.breaks, validFrom: dates.validFrom, validTo: dates.validTo, rateKind: "unknown", rateClass: r.rateClass });
        blocks += 1;
      }
    }
    group = null;
  };
  const addDests = (frag) => {
    const codes = frag.replace(/\bII\b/g, " ").split(/[\/\s]+/).filter(Boolean);
    if (!codes.every((c) => CODE3.test(c))) {
      problems.push(`a destination cell this reader does not understand ("${frag.slice(0, 40)}")`);
      return;
    }
    (group ? group.dests : pending).push(...codes);
  };
  const raw = lines.map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    if (/^General Information/i.test(line)) break;
    const tokens = line.split(/\s+/);
    const h = parseCommodityHeader(tokens);
    if (h) {
      if (h.unsupported) return { ok: false, reason: `a table header this reader does not handle (${h.unsupported})` };
      spec = h;
      continue;
    }
    if (!spec) continue;
    const m = COMMODITY.exec(line);
    if (!m) {
      if (isDestFragment(line)) addDests(line);
      else if (/^[A-Za-z][A-Za-z ]*$/.test(line) && !/CHECK WITH SALES/i.test(line)) {
        // a region heading (Middle East, Europe, Africa...) closes the block and forgets any unattached destinations
        close();
        pending = [];
      }
      continue;
    }
    const frag = line.slice(0, m.index).trim();
    const cls = commodityClass(m[1].replace(/\s+/g, " "));
    if (cls === "GCR") {
      close();
      group = { dests: [...pending], rows: [] };
      pending = [];
    }
    if (frag) {
      if (isDestFragment(frag)) addDests(frag);
      else {
        problems.push(`unexpected text before a commodity ("${frag.slice(0, 40)}")`);
        continue;
      }
    }
    if (!group) {
      problems.push(`a ${cls} row with no GCR row above it`);
      continue;
    }
    let rest = line.slice(m.index + m[0].length).trim().split(/\s+/).filter(Boolean);
    // a wrapped row: the rest of the figures sit on the next line
    while (rest.length < spec.cols.length && cls !== "VAL" && i + 1 < raw.length && raw[i + 1].split(/\s+/).every((x) => NUM.test(x) || x === "-")) {
      rest = rest.concat(raw[i + 1].split(/\s+/));
      i += 1;
    }
    if (!rest.every((x) => NUM.test(x) || x === "-")) {
      problems.push(`a ${cls} row has text where figures belong ("${rest.join(" ").slice(0, 40)}")`);
      continue;
    }
    if (cls === "VAL") {
      // valuable cargo: a flat minimum and sometimes one rate; no weight breaks
      if (rest.length < 1 || rest.length > 2) {
        problems.push(`a VAL row with ${rest.length} figures`);
        continue;
      }
      const minus45 = rest[1] !== undefined && rest[1] !== "-" ? L.toNumber(rest[1]) : null;
      group.rows.push({ rateClass: "VAL", breaks: { min: rest[0] === "-" ? null : L.toNumber(rest[0]), minus45 } });
      close();
      continue;
    }
    if (rest.length !== spec.cols.length) {
      problems.push(`a ${cls} row has ${rest.length} figures, the table has ${spec.cols.length}`);
      continue;
    }
    if (rest.every((x) => x === "-")) continue; // no rate on offer for this commodity
    const breaks = {};
    const slots = L.mapThresholds(spec.kgs);
    let ri = 0;
    spec.cols.forEach((col, k) => {
      const n = rest[k] === "-" ? null : L.toNumber(rest[k]);
      if (col.kind === "min") breaks.min = n;
      else breaks[slots[ri++]] = n;
    });
    group.rows.push({ rateClass: cls, breaks });
  }
  close();
  if (problems.length) return { ok: false, reason: `${problems.length} problem(s), e.g. ${problems[0]}` };
  if (blocks < 5 || out.length < 20) return { ok: false, reason: "too few table lines were found" };
  return { ok: true, rows: L.normalizeRows(out, carrier), lines: out.length, skipped: 0, blocks };
}

const sameBreaks = (a, b) => ["min", "minus45", "plus45", "plus100", "plus250", "plus300", "plus500", "plus1000"].every((k) => {
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
  // A file with one origin (the usual case) is checked on destination, currency and numbers: the AI sometimes takes a rate-class
  // heading (like AXA) for an origin, and that is not a reason to distrust numbers that are otherwise identical.
  const oneOrigin = new Set(tableRows.map((r) => r.origin)).size === 1;
  const byRoute = new Map();
  for (const r of tableRows) {
    const k = `${oneOrigin ? "" : r.origin}|${r.destination}|${r.currency}`;
    if (!byRoute.has(k)) byRoute.set(k, []);
    byRoute.get(k).push(r);
  }
  let mismatches = 0;
  const examples = [];
  for (const a of aiRows) {
    // An AI row with no currency (the page did not state one) is compared on the route alone.
    const mine = a.currency ? byRoute.get(`${oneOrigin ? "" : a.origin}|${a.destination}|${a.currency}`) || [] : tableRows.filter((r) => (oneOrigin || r.origin === a.origin) && r.destination === a.destination);
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

module.exports = { pdfTextLines, readCommodityTable, effectiveShort, parseListHeader, readListTable, bookedFromDate, parseHeader, parseSectionHeader, sectionClasses, effectiveDates, readSectionTable, classFromCardId, titleClass, readTable, verifySample, samplePartIndexes };
