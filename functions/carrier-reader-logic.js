/** Pure helpers for the automatic circular reader: tidy what the AI returned, name the records, build the instructions. */
const { ALL_BREAKS } = require("./tariff-checks");

/** "1,250.50", 31, "31.0 " -> number; anything else -> null. */
function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

const code = (v, len) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, len);
const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").trim()) ? String(v).trim() : "");

/**
 * The AI's rows -> clean rows. The currency is never guessed: if the circular does not show it, it stays empty and the
 * checks hold the row. Rows without a route are dropped.
 */
function normalizeRows(parsed, fallbackCarrier = "") {
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed) ? parsed : [];
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const origin = code(r.origin, 3);
    const destination = code(r.destination, 3);
    if (origin.length !== 3 || destination.length !== 3) continue;
    const breaks = {};
    for (const k of ALL_BREAKS) {
      const n = toNumber(r.breaks?.[k]);
      breaks[k] = n !== null && n > 0 ? n : n === 0 ? 0 : null;
    }
    out.push({
      carrierCode: code(r.carrierCode, 3) || code(fallbackCarrier, 3),
      origin,
      destination,
      currency: /^[A-Za-z]{3}$/.test(String(r.currency ?? "").trim()) ? String(r.currency).trim().toUpperCase() : "",
      breaks,
      validFrom: iso(r.validFrom),
      validTo: iso(r.validTo),
      rateKind: ["contract", "published"].includes(r.rateKind) ? r.rateKind : "unknown",
      notes: typeof r.notes === "string" ? r.notes.slice(0, 300) : "",
    });
  }
  return out;
}

/** The stored record's name: airline, route, currency. Stable, so a new circular replaces the same row. */
function tariffDocId(row) {
  return [row.carrierCode, row.origin, row.destination, row.currency || "NA"].join("_").replace(/[^A-Za-z0-9_]/g, "");
}

function fileKind(fileName, storagePath) {
  const n = String(fileName || storagePath || "").toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (/\.(xlsx|xlsm|xls)$/.test(n)) return "sheet";
  return "other";
}

/** Where a printed rate column starts (kg) -> our own weight break. Only weights we hold a column for; anything else is refused, never guessed. */
function breakForThreshold(t) {
  if (!Number.isFinite(t) || t < 0) return null;
  if (t < 45) return "minus45"; // the base rate: "Normal", "General", "Below 45", or a column that applies from the first kilo
  return { 45: "plus45", 100: "plus100", 300: "plus300", 500: "plus500", 1000: "plus1000" }[t] ?? null;
}

/** [0, 100, 300] -> ["minus45", "plus100", "plus300"], or null when a weight is one we have no column for or two columns land on the same break. */
function mapThresholds(ts) {
  const out = ts.map(breakForThreshold);
  if (out.some((x) => x === null) || new Set(out).size !== out.length) return null;
  return out;
}

const LEADING = ["carrier", "origin", "destination", "currency", "validFrom", "validTo", "rateKind", "min"];

const FORMAT =
  "Reply with ONLY plain lines, no markdown, no commentary. " +
  "Line 1 is COLUMNS followed by the weight in kg at which each printed per-kg rate column starts, left to right, separated by | , for example COLUMNS|0|100|300|500. " +
  "Use 0 for a column that applies from the first kilo (headed Normal, General, Below 45 and so on). List only per-kg rate columns, never the minimum charge. Read the numbers from the column headings; do not assume them. " +
  "Then one line per route (origin and destination), with these fields separated by | : " +
  "carrier (2-letter airline code) | origin (3-letter airport) | destination (3-letter airport) | currency (3-letter code exactly as the document states it, whether in the rate table, a heading, or a note or footnote such as 'rates in INR' or 'INR 12 per kg' on any page; empty only if the document does not say anywhere) | " +
  "validFrom (YYYY-MM-DD or empty) | validTo (YYYY-MM-DD or empty) | rateKind (contract, published or unknown) | min (flat minimum charge or empty) | " +
  "then one per-kg rate for each column named on the COLUMNS line, in the same order (empty if not shown) | " +
  "notes (short, only if something is unclear, never contains the | character). " +
  "Write numbers plainly, for example 28.5, without currency symbols or thousands separators. Leave a field empty, never write 0 or a guess, when the document does not clearly show it. " +
  "rateKind is contract if the document calls itself an agreement or contract rate, published if it calls itself a published or standard tariff, else unknown. " +
  "Never invent, estimate or calculate a number that is not printed. Do not guess the currency: if it is not stated, leave it empty. " +
  "If this part of the document contains no airline rates at all, reply with exactly: NONE";

/**
 * The AI's reply -> { rows, columns } in the shape normalizeRows expects.
 * The COLUMNS line says where each printed rate column starts; this code, not the AI, matches those weights to our own breaks.
 * Returns null when the reply is empty, has no usable COLUMNS line, names a weight we have no column for, or has no usable route line,
 * so the read is treated as unreadable. Only a bare "NONE" is a valid read with no routes.
 */
function parseRowLines(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null; // an empty reply is not a read: it is flagged, never taken to mean "no routes"
  if (/^none[.!]?$/i.test(raw)) return { rows: [], columns: [] };
  const cleaned = raw.split(/\r?\n/).map((l) => l.replace(/^[\s`*>\-]+/, "").split("|").map((x) => x.trim()));
  const head = cleaned.find((p) => /^columns$/i.test(p[0]));
  if (!head) return null;
  const thresholds = head.slice(1).filter((x) => x !== "").map((x) => toNumber(x));
  if (!thresholds.length || thresholds.some((x) => x === null)) return null;
  const slots = mapThresholds(thresholds);
  if (!slots) return null;
  const width = LEADING.length + thresholds.length + 1; // leading fields, one rate per column, notes
  const rows = [];
  for (const parts of cleaned) {
    if (parts.length !== width) continue;
    const [carrier, origin, destination, currency, validFrom, validTo, rateKind, min, ...rest] = parts;
    if (!/^[A-Za-z0-9]{2,3}$/.test(carrier) || !/^[A-Za-z]{3}$/.test(origin) || !/^[A-Za-z]{3}$/.test(destination)) continue; // a header or stray line
    const breaks = { min: min === "" ? null : min, minus45: null, plus45: null, plus100: null, plus300: null, plus500: null, plus1000: null };
    slots.forEach((slot, i) => {
      breaks[slot] = rest[i] === "" ? null : rest[i];
    });
    rows.push({ carrierCode: carrier, origin, destination, currency: currency || null, validFrom: validFrom || null, validTo: validTo || null, rateKind, breaks, notes: rest[thresholds.length] || "" });
  }
  return rows.length ? { rows, columns: thresholds } : null;
}

/**
 * A long spreadsheet -> parts small enough for the AI to answer in full. Each part repeats the sheet's first few lines (the column
 * headings) and starts a few lines before the last one ended, so a route that straddles a boundary is seen whole at least once.
 */
function chunkSheets(sheets, { maxChars = 8000, headerLines = 6, overlap = 3 } = {}) {
  const out = [];
  for (const { name, csv } of sheets) {
    const lines = String(csv ?? "")
      .split(/\r?\n/)
      .filter((l) => l.replace(/[,\s]/g, "") !== "");
    if (!lines.length) continue;
    const headerText = lines.slice(0, headerLines).join("\n");
    const bodies = [];
    let start = 0;
    while (start < lines.length) {
      let text = start === 0 ? "" : headerText + "\n";
      let end = start;
      while (end < lines.length && (end === start || text.length + lines[end].length + 1 <= maxChars)) {
        text += lines[end] + "\n";
        end += 1;
      }
      bodies.push(text);
      if (end >= lines.length) break;
      start = Math.max(end - overlap, start + 1);
    }
    bodies.forEach((text, i) => {
      const label = bodies.length > 1 ? `${name} (part ${i + 1} of ${bodies.length})` : name;
      out.push({ label, text: `The document is a spreadsheet, shown here as text. Sheet: ${label}\n\n${text}` });
    });
  }
  return out;
}

/** Rows read from the parts of one circular -> one list. A route seen twice (the parts overlap) keeps its first reading. */
function mergeRows(parts) {
  const seen = new Set();
  const out = [];
  for (const rows of parts) {
    for (const r of rows) {
      const k = [r.carrierCode, r.origin, r.destination, r.currency].join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

/** Run fn over items, at most `limit` at a time, keeping the results in order. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Two differently-framed instructions, so the two reads are independent rather than a copy of each other. */
function systemPrompts() {
  const base = "You read airline general-cargo tariff documents (PDF or spreadsheet text) for a freight forwarder and extract the airline's rates. ";
  return [
    base + "Work row by row in the order the document prints them: for each route line, copy its rates across. " + FORMAT,
    base + "First list every route (origin, destination) the document covers. Then, for each route, go through each weight-break column in turn and read the number from that column. Re-check each number against the page before you write it. " + FORMAT,
  ];
}


/** The Air desk's own weight-break names, in order (see AIR_WEIGHT_BREAKS in the app). */
const DESK_BREAKS = ["min", "minus45", "plus45", "plus100", "plus300", "plus500", "plus1000"];

/** An airline's rates are what the airline charges us, so on the desk they are BUY; SELL is the desk's own and stays empty. null when no rate at all. */
function deskBreaksFromRow(row) {
  const out = {};
  let any = false;
  for (const k of DESK_BREAKS) {
    const n = Number(row && row.breaks ? row.breaks[k] : null);
    const v = Number.isFinite(n) && n > 0 ? n : 0;
    if (v > 0) any = true;
    out[k] = { sell: 0, buy: v };
  }
  return any ? out : null;
}

/** The airline's name as the desk shows it: the circular's own record if it is a name, else the airline list, else the code. */
function carrierNameFor(code, circularCarrier, names) {
  const c = String(circularCarrier || "").trim();
  const upper = String(code || "").toUpperCase();
  if (c && !/^[A-Za-z0-9]{2,3}$/.test(c) && c.toUpperCase() !== upper) return c;
  return (names && names[upper]) || c || upper;
}

/**
 * What to write into the desk's published rate list (air_tariffs) for the rows just applied: one record per airline and
 * lane, replacing whatever the desk already had for that airline on that lane. existing is { "ORIGIN|DEST": docId }.
 * Rows with no usable rate are skipped. Never touches SELL.
 */
function planDeskPublish(rows, existingByLane, ctx) {
  const plan = [];
  for (const r of rows) {
    const breaks = deskBreaksFromRow(r);
    if (!breaks || !r.currency) continue;
    const key = `${r.origin}|${r.destination}`;
    plan.push({
      docId: (existingByLane && existingByLane[key]) || null,
      data: {
        carrier: carrierNameFor(r.carrierCode, ctx.circularCarrier, ctx.names),
        carrierCode: r.carrierCode,
        origin: r.origin,
        destination: r.destination,
        currency: r.currency,
        breaks,
        validFrom: r.validFrom || "",
        validTo: r.validTo || "",
        source: "carrier_board",
        sourceCircularId: ctx.circularId || "",
        uploadedBy: "carrier-board",
        published: true,
      },
    });
  }
  return plan;
}

/** Auto-read: when an airline tariff circular is uploaded the server reads it by itself, within a monthly spending limit. */
const AUTO_DEFAULTS = { enabled: true, monthlyCapUsd: 3 };
/** What one circular costs to read twice, roughly. A read is not started if it could take the month past the limit. */
const AUTO_READ_COST_USD = 0.3;

function parseAutoSettings(data) {
  const d = data || {};
  const cap = Number(d.monthlyCapUsd);
  return { enabled: d.enabled !== false, monthlyCapUsd: Number.isFinite(cap) && cap >= 0 ? cap : AUTO_DEFAULTS.monthlyCapUsd };
}

/** The admin's input -> clean settings, or a plain-words problem. */
function parseAutoInput(data) {
  const d = data || {};
  const cap = Number(d.monthlyCapUsd);
  if (!Number.isFinite(cap) || cap < 0 || cap > 100) return { error: "The monthly limit must be an amount in dollars, from 0 to 100." };
  return { enabled: d.enabled === true, monthlyCapUsd: Math.round(cap * 100) / 100 };
}

/** Should this upload be read automatically? spentUsd is what circular reading has cost so far this month. */
function autoDecision(settings, spentUsd, estimateUsd = AUTO_READ_COST_USD) {
  const s = parseAutoSettings(settings);
  if (!s.enabled) return { run: false, reason: "Auto-read is switched off. Read it from the Carrier board's administrator tools." };
  const spent = Number(spentUsd) || 0;
  if (spent + estimateUsd > s.monthlyCapUsd) {
    return { run: false, reason: `This month's circular-reading limit ($${s.monthlyCapUsd.toFixed(2)}, $${spent.toFixed(2)} used) would be passed. Raise the limit, or read it yourself from the Carrier board's administrator tools.` };
  }
  return { run: true };
}

/** Many circulars name their origin only in the file title ("ET_AMD", "6E-BOM", "EK_MAA_PXS AND PXD"). The three letters after the airline code, or null. */
function originHint(title) {
  const m = /^\s*[A-Z0-9]{2}[_ -]([A-Z]{3})(?![A-Za-z])/.exec(String(title || "").toUpperCase());
  return m ? m[1] : null;
}

/** The admin may say which currency a circular that prints none is in. Only rows with no currency are filled; anything printed stays. */
function withDefaultCurrency(rows, currency) {
  const c = String(currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return rows;
  return rows.map((r) => (r.currency ? r : { ...r, currency: c }));
}

module.exports = { originHint, withDefaultCurrency, AUTO_DEFAULTS, AUTO_READ_COST_USD, parseAutoSettings, parseAutoInput, autoDecision, DESK_BREAKS, deskBreaksFromRow, carrierNameFor, planDeskPublish, toNumber, normalizeRows, tariffDocId, fileKind, systemPrompts, parseRowLines, breakForThreshold, mapThresholds, chunkSheets, mergeRows, mapLimit };
