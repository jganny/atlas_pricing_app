import type { AirTariff, ParsedEnquiry, SeaTariff, SmartQuoteDraft } from "@/lib/types";

export const SMART_QUOTE_PREFILL_KEY = "atlas-smart-quote-prefill";

export interface SmartQuotePrefill {
  mode: "air" | "sea";
  parsed: ParsedEnquiry;
  carrierLabel: string;
  tariffFound: boolean;
  airBreaks?: AirTariff["breaks"];
  seaTariff?: Pick<SeaTariff, "mode" | "lclRate" | "fclRates" | "currency" | "carrier">;
  currency?: string;
  createdAt: number;
}

export function storeSmartQuotePrefill(prefill: SmartQuotePrefill) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SMART_QUOTE_PREFILL_KEY, JSON.stringify(prefill));
}

export function consumeSmartQuotePrefill(expectedMode?: "air" | "sea"): SmartQuotePrefill | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SMART_QUOTE_PREFILL_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SmartQuotePrefill;
    if (expectedMode && data.mode !== expectedMode) return null;
    sessionStorage.removeItem(SMART_QUOTE_PREFILL_KEY);
    return data;
  } catch {
    sessionStorage.removeItem(SMART_QUOTE_PREFILL_KEY);
    return null;
  }
}

export function draftToPrefill(
  mode: "air" | "sea",
  draft: SmartQuoteDraft,
): SmartQuotePrefill {
  return {
    mode,
    parsed: draft.parsed,
    carrierLabel: draft.carrierLabel,
    tariffFound: draft.tariffFound,
    airBreaks: draft.airBreaks,
    seaTariff: draft.seaTariff,
    currency: draft.currency,
    createdAt: Date.now(),
  };
}

/** Field-level confidence for review UI (premium innovation). */
export function fieldConfidence(parsed: ParsedEnquiry, mode: "air" | "sea") {
  return [
    {
      key: "customer",
      label: "Customer",
      value: parsed.customer || "—",
      ok: Boolean(parsed.customer),
    },
    {
      key: "route",
      label: "Route",
      value: parsed.origin && parsed.destination ? `${parsed.origin} → ${parsed.destination}` : "—",
      ok: Boolean(parsed.origin && parsed.destination),
    },
    {
      key: "carrier",
      label: mode === "air" ? "Airline" : "Liner",
      value:
        mode === "air"
          ? parsed.airlineLabel || parsed.airline || "—"
          : parsed.linerLabel || "—",
      ok: mode === "air" ? Boolean(parsed.airline || parsed.airlineLabel) : Boolean(parsed.linerLabel),
    },
    {
      key: "cargo",
      label: mode === "air" ? "Packages" : "Containers / cargo",
      value:
        mode === "air"
          ? parsed.packages.length
            ? `${parsed.packages.length} line(s)`
            : "—"
          : parsed.containers.length
            ? parsed.containers.map((c) => `${c.qty}×${c.type}`).join(", ")
            : parsed.grossWeight
              ? `${parsed.grossWeight} kg`
              : "—",
      ok:
        mode === "air"
          ? parsed.packages.length > 0
          : parsed.containers.length > 0 || Boolean(parsed.grossWeight || parsed.volume),
    },
  ] as const;
}
