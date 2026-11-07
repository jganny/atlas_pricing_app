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

const FIELDS = ["carrier", "origin", "destination", "currency", "validFrom", "validTo", "rateKind", "min", "minus45", "plus45", "plus100", "plus300", "plus500", "plus1000", "notes"];

const FORMAT =
  "Reply with ONLY lines, one line per route (origin and destination), no markdown, no commentary, no header line. Each line has exactly 15 fields separated by the | character, in this order: " +
  "carrier (2-letter airline code) | origin (3-letter airport) | destination (3-letter airport) | currency (3-letter code exactly as the document states, or empty if it does not say) | " +
  "validFrom (YYYY-MM-DD or empty) | validTo (YYYY-MM-DD or empty) | rateKind (contract, published or unknown) | min (flat minimum charge or empty) | minus45 (per kg under 45 kg or empty) | " +
  "plus45 (per kg 45 kg and over or empty) | plus100 (per kg or empty) | plus300 (per kg or empty) | plus500 (per kg or empty) | plus1000 (per kg or empty) | notes (short, only if something is unclear, never contains the | character). " +
  "Write numbers plainly, for example 28.5, without currency symbols or thousands separators. Leave a field empty, never write 0 or a guess, when the document does not clearly show it. " +
  "Weight breaks may be labelled N, Q, M, +45, 45-99 and so on; map each onto the nearest of these by its weight threshold, not by its label. " +
  "rateKind is contract if the document calls itself an agreement or contract rate, published if it calls itself a published or standard tariff, else unknown. " +
  "Never invent, estimate or calculate a number that is not printed. Do not guess the currency: if it is not stated, leave it empty. " +
  "If this part of the document contains no airline rates at all, reply with exactly: NONE";

/**
 * The AI's reply (one pipe-separated line per route) -> { rows } in the shape normalizeRows expects.
 * Lines that are not a route are ignored. Returns null when the reply has content but not one usable line, so the read is
 * treated as unreadable; "NONE" or an empty reply is a valid read with no routes.
 */
function parseRowLines(text) {
  const raw = String(text ?? "").trim();
  if (!raw || /^none\b/i.test(raw)) return { rows: [] };
  const rows = [];
  for (const line of raw.split(/\r?\n/)) {
    const parts = line.replace(/^[\s`*>\-]+/, "").split("|").map((x) => x.trim());
    if (parts.length !== FIELDS.length) continue;
    const [carrier, origin, destination, currency, validFrom, validTo, rateKind, ...rest] = parts;
    if (!/^[A-Za-z0-9]{2,3}$/.test(carrier) || !/^[A-Za-z]{3}$/.test(origin) || !/^[A-Za-z]{3}$/.test(destination)) continue; // a header or stray line
    const breaks = {};
    ["min", "minus45", "plus45", "plus100", "plus300", "plus500", "plus1000"].forEach((k, i) => {
      breaks[k] = rest[i] === "" ? null : rest[i];
    });
    rows.push({ carrierCode: carrier, origin, destination, currency: currency || null, validFrom: validFrom || null, validTo: validTo || null, rateKind, breaks, notes: rest[7] || "" });
  }
  return rows.length ? { rows } : null;
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

module.exports = { toNumber, normalizeRows, tariffDocId, fileKind, systemPrompts, parseRowLines, chunkSheets, mergeRows, mapLimit, FIELDS };
