export const INCIDENTAL_TERM =
  "Any other incidental/statutory charges, if any, would be applicable at actuals at the time of shipment";

function hasIncidental(terms: string): boolean {
  const hay = terms.toLowerCase();
  return (
    hay.includes("incidental") ||
    hay.includes("statutory") ||
    (hay.includes("at actuals") && hay.includes("shipment"))
  );
}

/** Append the incidental/statutory clause once when missing. */
export function ensureIncidentalTerm(terms: string): string {
  if (hasIncidental(terms)) return terms;
  const lines = terms
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  const numbered = lines.length > 0 && /^\d+[\.\)]\s/.test(lines[0].trim());
  const next = numbered ? `${lines.length + 1}. ${INCIDENTAL_TERM}` : INCIDENTAL_TERM;
  return [...lines, next].join("\n");
}

export const DEFAULT_AIR_TERMS = ensureIncidentalTerm(
  "1. The above rates are NET NET\n" +
    "2. Rates quoted are valid for General/ Non Haz/ Non Stackable, unless specified.\n" +
    "3. Quoted rates are subject to space and booking confirmation.\n" +
    "4. Transit Times are subject to the Service chosen.",
);

export const DEFAULT_SEA_TERMS = ensureIncidentalTerm(
  "1. The Above rates are NET NET\n" +
    "2. Rates are subject to Surcharges, if applicable at the time of shipment.\n" +
    "3. Rates are valid for Non Haz, Non Temp, Non Stackable, General cargo only.\n" +
    "4. Rates are subject to space, booking and onward confirmation.",
);

export function getDefaultFreightTerms(mode: "air" | "sea"): string {
  return mode === "sea" ? DEFAULT_SEA_TERMS : DEFAULT_AIR_TERMS;
}

/** Uppercase airport/port codes; keep the word "via" lowercase. DIRECT stays DIRECT. */
export function normalizeRouting(routing: string): string {
  const t = routing.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase();
    if (lower === "via") return "via";
    if (lower === "direct") return "DIRECT";
    return word.toUpperCase();
  });
}

/** Routing preview: prefix "via " unless DIRECT / empty. Codes stay CAPS; via is lowercase. */
export function formatRoutingPreview(routing: string): string {
  const r = normalizeRouting(routing);
  if (!r) return "";
  if (/^DIRECT\b/.test(r)) return r;
  if (/^via\s+/i.test(r)) {
    const rest = r.replace(/^via\s+/i, "").trim();
    return rest ? `via ${rest}` : "via";
  }
  return `via ${r}`;
}

/** Transit preview: "4" / "3-4" → suffix " Days". */
export function formatTransitPreview(tt: string): string {
  const t = tt.trim();
  if (!t) return "";
  if (/day/i.test(t)) return t;
  if (/^\d+(\s*[-–to]+\s*\d+)?$/i.test(t)) {
    return `${t.replace(/\s*to\s*/i, "-").replace(/\s*–\s*/g, "-")} Days`;
  }
  return t;
}
