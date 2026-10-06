import type { EnquiryRecord } from "@/lib/types";
import {
  HISTORICAL_LOOKBACK_DAYS,
  normalizeCarrierName,
  parseCreatedAt,
  withinLookbackDays,
} from "@/lib/quotes/historical-autofill";

/** A lane needs at least this many won+lost quotes before the panel says anything — fewer is noise. */
export const MIN_DECIDED_QUOTES = 4;
/** Price bands need at least this many priced won AND lost quotes combined. */
const MIN_PRICED_SAMPLES = 3;

export interface RateBand {
  min: number;
  max: number;
  count: number;
}

export interface WinLossRecent {
  id: string;
  customer: string;
  month: string;
  outcome: "won" | "lost";
  rate: number | null;
}

export type PricePosition = "in-wins" | "between" | "in-losses" | "unknown";

export interface WinLossSummary {
  decided: number;
  won: number;
  lost: number;
  open: number;
  winRatePct: number;
  enough: boolean;
  wonBand: RateBand | null;
  lostBand: RateBand | null;
  /** Highest rate you have ever WON at, and how the quotes above it went. */
  aboveWonCeiling: { rate: number; lost: number; total: number } | null;
  position: PricePosition;
  recent: WinLossRecent[];
}

export interface WinLossQuery {
  mode: "air" | "sea";
  origin: string;
  destination: string;
  currency: string;
  /** The rate on the quote being built now (per kg for Air), when known. */
  currentRate?: number | null;
}

/**
 * Per-unit sell rate of a past quote, in its own currency. Air stores the
 * applied per-kg rate; Sea only has one when it was quoted by revenue ton.
 */
function unitRate(e: EnquiryRecord, mode: "air" | "sea"): number | null {
  if (typeof e.appliedRate === "number" && e.appliedRate > 0) return e.appliedRate;
  if (mode === "sea" && e.billingUnit === "rt" && (e.billingWeight ?? 0) > 0 && (e.grandTotal ?? 0) > 0) {
    return (e.grandTotal as number) / (e.billingWeight as number);
  }
  return null;
}

/** "BLR - Bengaluru International Airport" and a bare "BLR" are the same place. */
function placeKey(raw: string): string {
  return normalizeCarrierName((raw || "").split(" - ")[0]);
}

function band(rates: number[]): RateBand | null {
  if (!rates.length) return null;
  return { min: Math.min(...rates), max: Math.max(...rates), count: rates.length };
}

export function summarizeWinLoss(
  enquiries: EnquiryRecord[],
  q: WinLossQuery,
  now: number = Date.now(),
): WinLossSummary {
  const origin = placeKey(q.origin);
  const destination = placeKey(q.destination);
  const currency = q.currency.trim().toUpperCase();

  const onLane = enquiries.filter(
    (e) =>
      e.mode === q.mode &&
      placeKey(e.origin) === origin &&
      placeKey(e.destination) === destination &&
      withinLookbackDays(parseCreatedAt(e.createdAt), HISTORICAL_LOOKBACK_DAYS, now),
  );

  const won = onLane.filter((e) => e.status === "won");
  const lost = onLane.filter((e) => e.status === "lost");
  const open = onLane.filter((e) => e.status === "open" || e.status === "quoted");
  const decided = won.length + lost.length;

  // Rates are only comparable inside one currency.
  const ratedIn = (list: EnquiryRecord[]) =>
    list
      .filter((e) => (e.currency || "").trim().toUpperCase() === currency)
      .map((e) => unitRate(e, q.mode))
      .filter((r): r is number => r !== null);
  const wonRates = ratedIn(won);
  const lostRates = ratedIn(lost);
  const priced = wonRates.length + lostRates.length >= MIN_PRICED_SAMPLES;
  const wonBand = priced ? band(wonRates) : null;
  const lostBand = priced ? band(lostRates) : null;

  let aboveWonCeiling: WinLossSummary["aboveWonCeiling"] = null;
  if (priced && wonBand) {
    const above = lostRates.filter((r) => r > wonBand.max).length;
    const aboveWon = wonRates.filter((r) => r > wonBand.max).length; // always 0 by definition
    if (above > 0) aboveWonCeiling = { rate: wonBand.max, lost: above, total: above + aboveWon };
  }

  let position: PricePosition = "unknown";
  const cur = q.currentRate;
  if (typeof cur === "number" && cur > 0 && priced) {
    if (wonBand && lostBand) {
      if (cur <= wonBand.max) position = "in-wins";
      else if (cur >= lostBand.min) position = "in-losses";
      else position = "between";
    } else if (wonBand && cur <= wonBand.max) position = "in-wins";
    else if (lostBand && cur >= lostBand.min) position = "in-losses";
  }

  const recent: WinLossRecent[] = [...won, ...lost]
    .sort((a, b) => parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt))
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      customer: e.customer,
      month: new Date(parseCreatedAt(e.createdAt)).toLocaleString("en", { month: "short" }),
      outcome: e.status === "won" ? "won" : "lost",
      rate:
        (e.currency || "").trim().toUpperCase() === currency ? unitRate(e, q.mode) : null,
    }));

  return {
    decided,
    won: won.length,
    lost: lost.length,
    open: open.length,
    winRatePct: decided ? Math.round((won.length / decided) * 100) : 0,
    enough: decided >= MIN_DECIDED_QUOTES,
    wonBand,
    lostBand,
    aboveWonCeiling,
    position,
    recent,
  };
}
