/**
 * Default local origin charges for the Air Nom desk on EXW and FCA terms.
 *
 * EXW:  Pickup (no amount, the desk enters it), Handling / C.Clr, Fumigation.
 * FCA:  Handling / C.Clr, Fumigation (the shipper delivers to the airline, so there is no pickup).
 *
 * Handling / C.Clr, on the chargeable weight (the higher of gross and volume weight), one rate for the whole shipment by its band:
 *   below 500 kg      0.15 per kg, but at least 75
 *   500 kg to 999 kg  0.10 per kg
 *   1000 kg and over  0.07 per kg
 * Fumigation is 35 per invoice. The amounts are the same in USD, EUR and GBP (no conversion); for any other quote currency
 * nothing is filled. As with the Sea EXW charges, the amounts go in the Buy column and Sell is left for the desk to price.
 */
import { createSurchargeRow, type SurchargeRow } from "./surcharges";

export type AirExwTerm = "EXW" | "FCA";

export const AIR_EXW_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export const AIR_EXW_ROW_PREFIX = "airexw_";
export const isAirExwRow = (r: Pick<SurchargeRow, "id">) => r.id.startsWith(AIR_EXW_ROW_PREFIX);

export const HANDLING_BANDS = {
  belowKg: 500,
  ratePerKgLow: 0.15,
  minimum: 75,
  midFromKg: 500,
  ratePerKgMid: 0.1,
  highFromKg: 1000,
  ratePerKgHigh: 0.07,
};
export const FUMIGATION_PER_INVOICE = 35;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Handling / C.Clr for a chargeable weight, or 0 when there is no weight yet. */
export function airHandlingAmount(chargeableKg: number): number {
  if (!(chargeableKg > 0)) return 0;
  const b = HANDLING_BANDS;
  if (chargeableKg < b.belowKg) return round2(Math.max(chargeableKg * b.ratePerKgLow, b.minimum));
  if (chargeableKg < b.highFromKg) return round2(chargeableKg * b.ratePerKgMid);
  return round2(chargeableKg * b.ratePerKgHigh);
}

/** The band and the working, in words, for the Remarks column. */
export function airHandlingRemark(chargeableKg: number): string {
  if (!(chargeableKg > 0)) return "Enter the cargo weight";
  const b = HANDLING_BANDS;
  const kg = `${round2(chargeableKg)} kg chargeable`;
  if (chargeableKg < b.belowKg) return `${b.ratePerKgLow}/kg, minimum ${b.minimum} (${kg})`;
  if (chargeableKg < b.highFromKg) return `${b.ratePerKgMid}/kg (${kg})`;
  return `${b.ratePerKgHigh}/kg (${kg})`;
}

/** Does this quote get the Air Nom defaults? EXW or FCA terms, in USD, EUR or GBP. */
export function airExwApplies(incoterm: string, currency: string): AirExwTerm | null {
  const t = String(incoterm || "").toUpperCase();
  if (t !== "EXW" && t !== "FCA") return null;
  return (AIR_EXW_CURRENCIES as readonly string[]).includes(String(currency || "").toUpperCase()) ? t : null;
}

export function buildAirExwRows(term: AirExwTerm, chargeableKg: number): SurchargeRow[] {
  const mk = (key: string, name: string, amount: number, remarks: string) =>
    createSurchargeRow({ id: `${AIR_EXW_ROW_PREFIX}${key}`, name, sell: 0, buy: amount, unit: "flat", remarks });
  const rows: SurchargeRow[] = [];
  if (term === "EXW") rows.push(mk("pickup", "Pickup", 0, "Amount to be entered"));
  rows.push(mk("handling", "Handling / C.Clr", airHandlingAmount(chargeableKg), airHandlingRemark(chargeableKg)));
  rows.push(mk("fumigation", "Fumigation", FUMIGATION_PER_INVOICE, "per invoice"));
  return rows;
}

const sameRows = (a: SurchargeRow[], b: SurchargeRow[]): boolean => {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((r) => [r.id, r]));
  return a.every((r) => {
    const o = byId.get(r.id);
    return !!o && o.name === r.name && o.sell === r.sell && o.buy === r.buy && o.unit === r.unit && o.remarks === r.remarks;
  });
};

/**
 * What to do with the Local Origin Charges when the terms, currency or weight change (same rules as the Sea EXW card):
 * "fill" when the desk has not touched what was filled, "clear" when the quote no longer qualifies and the filled rows are
 * untouched, "keep" when the desk edited, deleted or added anything, or opened a saved quote.
 * `previous` is what was filled last time; `next` the fill for the current inputs (null when the quote does not qualify).
 */
export function airExwFillDecision(args: { current: SurchargeRow[]; previous: SurchargeRow[] | null; next: SurchargeRow[] | null }): "fill" | "clear" | "keep" {
  const { current, previous, next } = args;
  const mine = current.filter(isAirExwRow);
  const typed = current.length - mine.length;
  if (!next) {
    if (!mine.length) return "keep";
    return previous && sameRows(mine, previous) ? "clear" : "keep";
  }
  if (typed > 0) return "keep";
  if (!mine.length) return previous ? "keep" : "fill";
  return previous && sameRows(mine, previous) ? "fill" : "keep";
}
