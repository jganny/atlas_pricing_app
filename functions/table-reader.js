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
    const rows = new Map();
    for (const it of tc.items) {
      const s = String(it.str || "");
      if (!s.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // items on one printed line share a height, give or take a point
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: s.trim() });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      lines.push(rows.get(y).sort((a, b) => a.x - b.x).map((c) => c.s).join(" ").replace(/\s+/g, " ").trim());
    }
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

module.exports = { pdfTextLines, parseHeader, classFromCardId, titleClass, readTable, verifySample, samplePartIndexes };
