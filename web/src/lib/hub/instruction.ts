/**
 * Reads the short instruction a person types next to a dropped enquiry, for example:
 *   "use BLR - EK rates for +100 and add a margin of 10/kg or 10% and quote in USD or EUR, exchange rate 83.5"
 * It only picks out what is clearly stated and reports what it found. Anything it cannot tell for certain
 * (two margins, two currencies) is returned as a choice for the person to settle with one tap — never guessed.
 */

export type BreakKey = "min" | "minus45" | "plus45" | "plus100" | "plus300" | "plus500" | "plus1000";
export type MarginKind = "perKg" | "percent";

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
}

const CURRENCIES = ["USD", "EUR", "INR", "GBP", "AED", "SGD", "AUD", "CAD", "CHF", "JPY", "CNY", "SAR", "QAR", "KWD", "OMR", "BHD", "THB", "MYR", "HKD"];
const CUR = CURRENCIES.join("|");
// Short capital words that are not airline codes.
const COMMON_WORDS = new Set(["IN", "TO", "OF", "AT", "IF", "OR", "AN", "AS", "ON", "BY", "NO", "SO", "UP", "US", "ME", "MY", "IT", "BE", "DO", "GO", "WE", "OK"]);
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
  const pct = /(\d+(?:\.\d+)?)\s*(?:%|per\s*cent|percent)/gi;
  for (const m of t.matchAll(pct)) out.margins.push({ kind: "percent", value: Number(m[1]) });
  t = t.replace(pct, " ");

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
      /\b(?:use|using|take|with)\s+([A-Z][A-Z0-9])\b/.exec(t) ||
      /\b([A-Z][A-Z0-9])\s+rates?\b/.exec(t) ||
      /\b([A-Z][A-Z0-9])\s+(?=(?:\+|plus\s*)?(?:45|100|300|500|1000)\b)/.exec(t);
    if (code && !CURRENCIES.includes(code[1]) && !COMMON_WORDS.has(code[1])) out.carrier = code[1];
    else {
      const named = /\b(?:use|using|take|with)\s+([A-Za-z][A-Za-z .&]{2,28}?)\s+(?:rates?|tariff|for)\b/i.exec(t);
      if (named) out.carrier = named[1].trim();
    }
    const origin = /\b(?:from|ex|origin)\s+([A-Za-z]{3})\b/i.exec(t);
    if (origin) out.originCode = origin[1].toUpperCase();
  }
  return out;
}

/** True when the person wrote something Vertex can act on (otherwise the drop works as before). */
export function hasInstruction(i: Instruction): boolean {
  return !!(i.carrier || i.weightBreak || i.margins.length || i.currencies.length || i.inrRate || i.crossRate);
}
