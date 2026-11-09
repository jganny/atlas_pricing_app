/**
 * Circular digests: for circulars that are not airline rate tables (shipping lines, coloaders, transporters, warehouses,
 * courier, fuel notices, anything else), the AI reads the file once and writes down what matters in plain words: who it is from,
 * when it applies, what it says, the charges it lists and the dates to act by. Pure functions only (no Firebase, no AI call).
 */

/** Everything except an airline rate table, which has its own reader. */
const DIGEST_CATEGORIES = ["line_circular", "sea_tariff", "courier_tariff", "fuel_circular_airline", "fuel_circular_shipping", "general"];
/** What one digest costs, roughly (a few cents). */
const DIGEST_COST_USD = 0.05;
const KINDS = ["liner", "coloader", "transporter", "warehouse", "courier", "airline", "other"];

const SYSTEM =
  "CIRCULAR DIGEST. You read one circular, notice or tariff document (PDF or spreadsheet text) sent to an Indian freight forwarder by a shipping line, coloader, transporter, warehouse, courier company or airline. " +
  "Write down what matters, in plain words, as ONE JSON object and nothing else (no markdown, no commentary). Keys: " +
  '"kind" (one of liner, coloader, transporter, warehouse, courier, airline, other); ' +
  '"company" (who sent it, as printed, else ""); ' +
  '"effectiveFrom" and "validTo" (YYYY-MM-DD, or "" when the document gives no date); ' +
  '"appliesTo" (one short line: the trades, ports, stations or services it covers, else ""); ' +
  '"summary" (an array of at most 8 short plain sentences: what this document says and what the reader needs to do); ' +
  '"charges" (an array of at most 40 objects {"name","amount","currency","unit","appliesTo","note"}: every charge, rate or surcharge the document lists; "amount" is a plain number or null; "unit" is for example per 20ft, per 40ft, per kg, per shipment, per day, percent); ' +
  '"deadlines" (an array of dates or conditions by which something changes or action is needed, each as a short sentence). ' +
  "Copy numbers and dates exactly as printed. Never guess or invent anything: use \"\" or [] where the document says nothing.";

const str = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const isoDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : "");
const strList = (v, max, len) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []);

/** The AI's reply (maybe wrapped in text or a code fence) -> a clean digest, or null when there is no usable JSON. */
function parseDigest(text) {
  const raw = String(text || "");
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let obj;
  try {
    obj = JSON.parse(raw.slice(a, b + 1));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const charges = (Array.isArray(obj.charges) ? obj.charges : [])
    .map((c) => {
      const amount = Number(String(c && c.amount !== undefined && c.amount !== null ? c.amount : "").replace(/,/g, ""));
      return { name: str(c && c.name, 120), amount: c && c.amount !== null && c.amount !== "" && Number.isFinite(amount) ? amount : null, currency: str(c && c.currency, 8).toUpperCase(), unit: str(c && c.unit, 60), appliesTo: str(c && c.appliesTo, 160), note: str(c && c.note, 200) };
    })
    .filter((c) => c.name)
    .slice(0, 40);
  const kind = KINDS.includes(obj.kind) ? obj.kind : "other";
  const digest = {
    kind,
    company: str(obj.company, 120),
    effectiveFrom: isoDay(obj.effectiveFrom),
    validTo: isoDay(obj.validTo),
    appliesTo: str(obj.appliesTo, 240),
    summary: strList(obj.summary, 8, 300),
    charges,
    deadlines: strList(obj.deadlines, 10, 200),
  };
  // A reply with nothing in it is no digest.
  if (!digest.summary.length && !digest.charges.length) return null;
  return digest;
}

module.exports = { DIGEST_CATEGORIES, DIGEST_COST_USD, KINDS, SYSTEM, parseDigest };
