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

const FORMAT =
  'Reply with ONLY a JSON object, no markdown, no commentary: {"rows":[{"carrierCode":"<2-letter airline code>","origin":"<3-letter airport>",' +
  '"destination":"<3-letter airport>","currency":"<3-letter currency exactly as the document states, or null if it does not say>",' +
  '"validFrom":"YYYY-MM-DD or null","validTo":"YYYY-MM-DD or null","rateKind":"contract"|"published"|"unknown",' +
  '"breaks":{"min":<flat minimum charge or null>,"minus45":<per kg under 45 kg or null>,"plus45":<per kg 45 kg and over or null>,' +
  '"plus100":<per kg or null>,"plus300":<per kg or null>,"plus500":<per kg or null>,"plus1000":<per kg or null>},"notes":"<short, only if something is unclear>"}]}. ' +
  "Weight breaks may be labelled N, Q, M, +45, 45-99 and so on; map each onto the nearest of these by its weight threshold, not by its label. " +
  "rateKind is \"contract\" if the document calls itself an agreement or contract rate, \"published\" if it calls itself a published or standard tariff, else \"unknown\". " +
  "Never invent, estimate or calculate a number that is not printed. Use null for anything not clearly shown. One row per route (origin and destination). " +
  "Do not guess the currency: if it is not stated, use null.";

/** Two differently-framed instructions, so the two reads are independent rather than a copy of each other. */
function systemPrompts() {
  const base = "You read airline general-cargo tariff documents (PDF or spreadsheet text) for a freight forwarder and extract the airline's rates. ";
  return [
    base + "Work row by row in the order the document prints them: for each route line, copy its rates across. " + FORMAT,
    base + "First list every route (origin, destination) the document covers. Then, for each route, go through each weight-break column in turn and read the number from that column. Re-check each number against the page before you write it. " + FORMAT,
  ];
}

module.exports = { toNumber, normalizeRows, tariffDocId, fileKind, systemPrompts };
