/**
 * Reads the short instruction a person types next to a dropped enquiry, for example:
 *   "use BLR - EK rates for +100 and add a margin of 10/kg or 10% and quote in USD or EUR, exchange rate 83.5"
 * It only picks out what is clearly stated and reports what it found. Anything it cannot tell for certain
 * (two margins, two currencies) is returned as a choice for the person to settle with one tap — never guessed.
 */

export type BreakKey = "min" | "minus45" | "plus45" | "plus100" | "plus300" | "plus500" | "plus1000";
export type MarginKind = "perKg" | "percent" | "perContainer" | "perCbm";

export interface MarginOption {
  kind: MarginKind;
  value: number;
}

export interface Instruction {
  /** Carrier named: a 2-letter code ("EK") or a name ("Emirates"). */
  carrier?: string;
  /** Origin airport named in the instruction ("BLR"). */
  originCode?: string;
  weightBreak?: BreakKey;
  /** Zero, one, or several (when "10/kg or 10%" leaves it open). */
  margins: MarginOption[];
  /** Currencies mentioned for the quote ("USD or EUR" gives two). */
  currencies: string[];
  /** INR per one unit of the quote currency, when an exchange rate was given. */
  inrRate?: number;
  /** "1 USD = 0.92 EUR". */
  crossRate?: { from: string; to: string; rate: number };
  /** A carrier rate the person stated themselves, in the quote currency (per kg for air, per unit for sea). */
  buyRate?: number;
  /** Sea only: the container asked for ("40HC") and whether it is full or part load. */
  container?: string;
  seaMode?: "fcl" | "lcl";
}

const CURRENCIES = ["USD", "EUR", "INR", "GBP", "AED", "SGD", "AUD", "CAD", "CHF", "JPY", "CNY", "SAR", "QAR", "KWD", "OMR", "BHD", "THB", "MYR", "HKD"];
const CUR = CURRENCIES.join("|");
// Short capital words that are not airline codes.
const COMMON_WORDS = new Set(["IN", "TO", "OF", "AT", "IF", "OR", "AN", "AS", "ON", "BY", "NO", "SO", "UP", "US", "ME", "MY", "IT", "BE", "DO", "GO", "WE", "OK", "IS", "AM", "HE", "HI", "PM", "OH", "KG", "PC", "RS", "ALL"]);
const STOP_WORDS = new Set(["the", "this", "that", "our", "your", "same", "current", "normal", "standard", "latest", "new", "old", "all", "any", "some", "rate", "rates", "margin", "tariff", "price", "prices", "freight", "airline", "carrier", "liner", "line"]);
const BREAK_BY_NUMBER: Record<string, BreakKey> = { "45": "plus45", "100": "plus100", "300": "plus300", "500": "plus500", "1000": "plus1000" };

export function parseInstruction(text: string): Instruction {
  const out: Instruction = { margins: [], currencies: [] };
  let t = ` ${text.replace(/[–—]/g, "-").replace(/\s+/g, " ")} `;

  // Exchange rates first, so their numbers are not mistaken for anything else.
  const cross = new RegExp(`1\\s*(${CUR})\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*(${CUR})`, "i").exec(t);
  if (cross) {
    out.crossRate = { from: cross[1].toUpperCase(), to: cross[3].toUpperCase(), rate: Number(cross[2]) };
    t = t.replace(cross[0], " ");
  }
  const inr = /(?:ex(?:change)?\.?\s*rate|roe|\brate(?=\s*(?:of|is|:|=|@|\d))|@)\s*(?:of|is|:|=|@)?\s*(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)/i.exec(t);
  if (inr) {
    out.inrRate = Number(inr[1]);
    t = t.replace(inr[0], " ");
  }

  // Margins: "10/kg", "10 per kg", "10%", "10 percent"
  const perKg = /(\d+(?:\.\d+)?)\s*(?:\/\s*kg|per\s*kg|p\.?\s*kg)\b/gi;
  for (const m of t.matchAll(perKg)) out.margins.push({ kind: "perKg", value: Number(m[1]) });
  t = t.replace(perKg, " ");
  const perCont = /(\d+(?:\.\d+)?)\s*(?:\/|per\s+)\s*(?:container|cntr|cont|box|teu|unit)s?\b/gi;
  for (const m of t.matchAll(perCont)) out.margins.push({ kind: "perContainer", value: Number(m[1]) });
  t = t.replace(perCont, " ");
  const perCbm = /(\d+(?:\.\d+)?)\s*(?:\/|per\s+)\s*(?:cbm|cubic\s*m(?:eter|etre)?s?)\b/gi;
  for (const m of t.matchAll(perCbm)) out.margins.push({ kind: "perCbm", value: Number(m[1]) });
  t = t.replace(perCbm, " ");
  const pct = /(\d+(?:\.\d+)?)\s*(?:%|per\s*cent|percent)/gi;
  for (const m of t.matchAll(pct)) out.margins.push({ kind: "percent", value: Number(m[1]) });
  t = t.replace(pct, " ");

  // Sea: "40HC", "20 GP", "40'HC" and full / part load
  const cont = /\b(20|40|45)\s*['′]?\s*(GP|DC|HC|HQ|RF|OT|FR)\b/i.exec(t);
  if (cont) {
    const kind = cont[2].toUpperCase();
    out.container = `${cont[1]}'${kind === "HQ" ? "HC" : kind === "DC" ? "GP" : kind}`;
  }
  if (/\bfcl\b/i.test(t)) out.seaMode = "fcl";
  else if (/\blcl\b/i.test(t)) out.seaMode = "lcl";

  // Weight break: "+100", "100+", "plus 100", "100 kg break"
  const brk = /(?:\+\s*|plus\s*)(45|100|300|500|1000)\b|\b(45|100|300|500|1000)\s*(?:\+|plus\b|kg\s*(?:\+|break|slab))/i.exec(t);
  if (brk) out.weightBreak = BREAK_BY_NUMBER[brk[1] || brk[2]];
  else if (/\b(?:minimum|min)\s*(?:charge|rate)?\b/i.test(t)) out.weightBreak = "min";
  else if (/(?:-|under\s*|below\s*)45\b/i.test(t)) out.weightBreak = "minus45";

  // Currencies, in the order written
  for (const m of t.matchAll(new RegExp(`\\b(${CUR})\\b`, "gi"))) {
    const c = m[1].toUpperCase();
    if (!out.currencies.includes(c)) out.currencies.push(c);
  }

  // "BLR - EK", "BLR/EK", "BLR EK rates"
  const pair = /\b([A-Za-z]{3})\s*[-/]\s*([A-Za-z0-9]{2})\b(?!\w)/.exec(t);
  if (pair && !CURRENCIES.includes(pair[1].toUpperCase())) {
    out.originCode = pair[1].toUpperCase();
    out.carrier = pair[2].toUpperCase();
  } else {
    // "use EK", "EK rates", or a code straight before the break ("EK +100")
    const code =
      /\b(?:use|using|take|with)\s+([A-Za-z][A-Za-z0-9])\b/i.exec(t) ||
      /\b([A-Za-z][A-Za-z0-9])\s+rates?\b/.exec(t) ||
      /\b([A-Z][A-Z0-9])\s+(?=(?:\+|plus\s*)?(?:45|100|300|500|1000)\b)/.exec(t);
    const found = code ? code[1].toUpperCase() : "";
    if (found && !CURRENCIES.includes(found) && !COMMON_WORDS.has(found)) out.carrier = found;
    else {
      // "use Emirates rates", "use maersk 40hc add 100/container", "use Hapag Lloyd lcl"
      const named = /\b(?:use|using|take|with)\s+([A-Za-z][A-Za-z.&-]{2,20}(?:\s+[A-Za-z][A-Za-z.&-]{1,15})??)\s*(?=rates?\b|tariff\b|for\b|\d|\+|add\b|plus\b|and\b|at\b|in\b|quote\b|lcl\b|fcl\b|margin\b|$)/i.exec(t);
      if (named && !STOP_WORDS.has(named[1].trim().split(/\s+/)[0].toLowerCase())) out.carrier = named[1].trim();
    }
    const origin = /\b(?:from|ex|origin)\s+([A-Za-z]{3})\b/i.exec(t);
    if (origin) out.originCode = origin[1].toUpperCase();
  }
  return out;
}

/** True when the person wrote something Vertex can act on (otherwise the drop works as before). */
export function hasInstruction(i: Instruction): boolean {
  return !!(i.carrier || i.weightBreak || i.container || i.seaMode || i.margins.length || i.currencies.length || i.inrRate || i.crossRate);
}

/** How many of the five things an instruction usually says were picked out by the rules. */
export function ruleScore(i: Instruction): number {
  return [i.carrier, i.weightBreak || i.container, i.margins.length, i.currencies.length, i.inrRate || i.crossRate || i.buyRate].filter(Boolean).length;
}

/** Plain-words instructions the rules only half understood are worth a second reading by the AI. */
export function shouldAskAI(text: string, rules: Instruction): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words >= 4 && ruleScore(rules) <= 2;
}

/** The rules win where they found something; the AI fills only what they left blank. */
export function mergeInstruction(rules: Instruction, ai: Partial<Instruction> | null | undefined): Instruction {
  if (!ai) return rules;
  return {
    carrier: rules.carrier ?? ai.carrier,
    originCode: rules.originCode ?? ai.originCode,
    weightBreak: rules.weightBreak ?? ai.weightBreak,
    margins: rules.margins.length ? rules.margins : ai.margins ?? [],
    currencies: rules.currencies.length ? rules.currencies : ai.currencies ?? [],
    inrRate: rules.inrRate ?? ai.inrRate,
    crossRate: rules.crossRate ?? ai.crossRate,
    buyRate: rules.buyRate ?? ai.buyRate,
    container: rules.container ?? ai.container,
    seaMode: rules.seaMode ?? ai.seaMode,
  };
}

/** "120 kg" typed with a quote request in Ask Vertex. The margin ("10/kg") is removed first so it is not read as a weight. */
export function weightFromText(text: string): number | undefined {
  const t = text.replace(/(\d+(?:\.\d+)?)\s*(?:\/\s*kg|per\s*kg|p\.?\s*kg)\b/gi, " ");
  const m = /(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kilograms?)\b/i.exec(t);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** "12 cbm" typed with a sea quote request; a margin's "/cbm" is not a volume. */
export function volumeFromText(text: string): number | undefined {
  const t = text.replace(/(\d+(?:\.\d+)?)\s*(?:\/|per\s+)\s*(?:cbm|cubic\s*m(?:eter|etre)?s?)\b/gi, " ");
  const m = /(\d+(?:\.\d+)?)\s*(?:cbm|cubic\s*m(?:eter|etre)?s?|m3)\b/i.exec(t);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
