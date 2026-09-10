/** Decide which desk should open from pasted enquiry text. */

export type QuoteDeskMode = "air" | "sea" | "courier" | "transport" | "warehouse";

/** Field labels like MODE (AIR/COURIER) are not the requested product. */
export function stripModeFieldLabels(text: string): string {
  return text
    .replace(/mode\s*\(\s*air\s*\/\s*courier\s*\)/gi, " ")
    .replace(/mode\s*\(\s*air\s*\/\s*sea\s*\)/gi, " ")
    .replace(/mode\s*\(\s*sea\s*\/\s*air\s*\)/gi, " ")
    .replace(/mode\s*\(\s*air\s*\/\s*ocean\s*\)/gi, " ");
}

function scoreAir(t: string): number {
  let n = 0;
  if (/\bair\s*freight\b/.test(t)) n += 8;
  if (/\bair\s*(export|import)\b/.test(t)) n += 6;
  if (/\b(awb|airway\s*bill)\b/.test(t)) n += 5;
  if (/\bchargeable\s*weight\b/.test(t) && /\bkg\b/.test(t)) n += 2;
  if (/\b(airline|flight|airport)\b/.test(t)) n += 3;
  if (/\b(emirates|qatar|etihad|lufthansa)\b/.test(t)) n += 2;
  if (/\bair\b/.test(t)) n += 1;
  return n;
}

function scoreSea(t: string): number {
  let n = 0;
  if (/\b(fcl|lcl|break\s*bulk|\bbb\b)\b/.test(t)) n += 8;
  if (/\b(sea\s*freight|ocean\s*freight)\b/.test(t)) n += 8;
  if (/\b(container|teu|liner|maersk|msc)\b/.test(t)) n += 4;
  if (/\bsea\b/.test(t)) n += 1;
  return n;
}

function scoreCourier(t: string): number {
  let n = 0;
  if (/\b(dhl|fedex|ups|aramex|bluedart|blue\s*dart)\b/.test(t)) n += 6;
  if (/\b(express\s+parcel|courier\s+desk|courier\s+service)\b/.test(t)) n += 6;
  if (/\bcourier\b/.test(t)) n += 3;
  if (/\bexpress\b/.test(t) && !/\bair\s*freight\b/.test(t)) n += 1;
  return n;
}

/**
 * Returns null when the text is not a freight job (so Ask Vertex can search).
 * Quote hub defaults null → air.
 */
export function classifyQuoteMode(text: string): QuoteDeskMode | null {
  const stripped = stripModeFieldLabels(text);
  const t = stripped.toLowerCase().replace(/\s+/g, " ");
  if (!t.trim()) return null;

  if (/\b(warehouse|storage\s+quote)\b/.test(t) && !/\bair\s*freight\b/.test(t) && !/\bsea\s*freight\b/.test(t)) {
    return "warehouse";
  }
  if (/\b(transport|truck|road\s*haulage|ftl|ltl)\b/.test(t) && !/\bair\s*freight\b/.test(t) && !/\bsea\s*freight\b/.test(t)) {
    return "transport";
  }

  const air = scoreAir(t);
  const sea = scoreSea(t);
  const courier = scoreCourier(t);
  const best = Math.max(air, sea, courier);

  if (best === 0) return null;
  if (air === best && air > 0) return "air";
  if (sea === best && sea > 0) return "sea";
  if (courier === best && courier > 0) return "courier";
  return null;
}

export function deskModeForPaste(text: string): QuoteDeskMode {
  return classifyQuoteMode(text) ?? "air";
}
