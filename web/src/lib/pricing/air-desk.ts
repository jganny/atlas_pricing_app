import {
  calculateAirFreight,
  type CargoLine,
  type WeightBreakName,
  type WeightBreaks,
} from "@atlas/pricing-core";
import type { AirlineOption } from "@/lib/pricing/carrier-options";
import { quoteSideRate } from "@/lib/pricing/quote-rate";
import {
  calcSurchargeCost,
  sumSurcharges,
  type CalculatedSurcharge,
} from "@/lib/pricing/surcharges";

export const AIR_WEIGHT_BREAKS: WeightBreakName[] = [
  "min",
  "minus45",
  "plus45",
  "plus100",
  "plus300",
  "plus500",
  "plus1000",
];

export const EMPTY_AIR_BREAKS: WeightBreaks = {
  min: { sell: 0, buy: 0 },
  minus45: { sell: 0, buy: 0 },
  plus45: { sell: 0, buy: 0 },
  plus100: { sell: 0, buy: 0 },
  plus300: { sell: 0, buy: 0 },
  plus500: { sell: 0, buy: 0 },
  plus1000: { sell: 0, buy: 0 },
};

export interface AirCargoRow {
  l: number;
  w: number;
  h: number;
  qty: number;
  gw: number;
}

export function cargoRowsToLines(rows: AirCargoRow[]): CargoLine[] {
  return rows.map((r) => ({
    length: r.l,
    width: r.w,
    height: r.h,
    qty: r.qty,
    grossWeightKg: r.gw,
  }));
}

export interface AirlineTotals {
  freight: ReturnType<typeof calculateAirFreight>;
  origin: CalculatedSurcharge[];
  dest: CalculatedSurcharge[];
  originTotal: number;
  destTotal: number;
  originBuy: number;
  destBuy: number;
  ams: number;
  /** Quote total: sell preferred, buy fallback per line while drafting. */
  grandSell: number;
  grandBuy: number;
  gp: number;
  /** True only when both freight sell and freight buy are entered (needed at Won). */
  gpReady: boolean;
  /** True when quote freight is coming from buy because sell is blank. */
  quoteUsingBuyFreight: boolean;
  baseFreightQuote: number;
}

/**
 * Practical desk math:
 * - Quote total uses Sell when set; if Sell blank, uses Buy so the desk still shows
 *   rate × kg + fees (e.g. 500 × 1.50 + AMS + origin).
 * - Buy total is always cost-only (AMS is customer/quote side).
 * - GP only when both freight sell and buy exist — required at Won/confirm, not while drafting.
 */
export function computeAirlineTotals(
  cargo: AirCargoRow[],
  option: AirlineOption,
): AirlineTotals {
  const freight = calculateAirFreight({
    cargo: cargoRowsToLines(cargo),
    breaks: option.wbEnabled ? option.breaks : EMPTY_AIR_BREAKS,
    pivotWeightKg: option.pivotWeightKg,
  });

  const bases = { chargeableKg: freight.chargeableWeightKg };
  const origin = option.originFeesEnabled
    ? option.originSurcharges
        .filter((r) => r.name.trim() && !/^ams(\s+fee)?$/i.test(r.name.trim()))
        .map((r) => calcSurchargeCost(r, bases))
    : [];
  const dest = option.destFeesEnabled
    ? option.destSurcharges
        .filter((r) => r.name.trim() && !/^ams(\s+fee)?$/i.test(r.name.trim()))
        .map((r) => calcSurchargeCost(r, bases))
    : [];

  const originSum = sumSurcharges(origin);
  const destSum = sumSurcharges(dest);
  const ams = option.amsFeeEnabled ? Number(option.amsFee) || 0 : 0;
  const baseSell = option.wbEnabled ? freight.baseFreightSell : 0;
  const baseBuy = option.wbEnabled ? freight.baseFreightBuy : 0;
  const baseFreightQuote = quoteSideRate(baseSell, baseBuy);
  const quoteUsingBuyFreight = baseSell <= 0 && baseBuy > 0;

  const grandSell = baseFreightQuote + originSum.quote + destSum.quote + ams;
  const grandBuy = baseBuy + originSum.buy + destSum.buy;
  const freightSellReady = baseSell > 0;
  const freightBuyReady = baseBuy > 0;
  const gpReady = freightSellReady && freightBuyReady;

  return {
    freight,
    origin,
    dest,
    originTotal: originSum.quote,
    destTotal: destSum.quote,
    originBuy: originSum.buy,
    destBuy: destSum.buy,
    ams,
    grandSell: grandSell > 0 ? grandSell : 0,
    grandBuy,
    gp: gpReady ? grandSell - grandBuy : 0,
    gpReady,
    quoteUsingBuyFreight,
    baseFreightQuote,
  };
}

export function validateAirCargo(cargo: AirCargoRow[]): string | null {
  if (!cargo.length) return "Add at least one cargo line.";
  for (const row of cargo) {
    if (row.l <= 0 || row.w <= 0 || row.h <= 0 || row.qty <= 0 || row.gw <= 0) {
      return "Fill all cargo dimensions and weights with values greater than zero.";
    }
  }
  return null;
}

export function validateSelectedAirline(option: AirlineOption | undefined): string | null {
  if (!option) return "Add and select an airline option.";
  if (!option.name.trim()) return "Enter carrier / airline on the selected option.";
  if (!option.routing.trim()) return "Enter routing on the selected option.";
  if (!option.tt.trim()) return "Enter transit time on the selected option.";
  if (!option.validity.trim()) return "Enter quote validity on the selected option.";
  return null;
}

/** @deprecated — kept for any remaining callers; prefer validateSelectedAirline */
export interface AirDeskInput {
  customer: string;
  origin: string;
  destination: string;
  currency: string;
  incoterm: string;
  commodity: string;
  airline: string;
  routing: string;
  tt: string;
  validity: string;
  pivotWeightKg: number;
  cargo: AirCargoRow[];
  breaks: WeightBreaks;
}

export function computeAirDesk(input: AirDeskInput) {
  return calculateAirFreight({
    cargo: cargoRowsToLines(input.cargo),
    breaks: input.breaks,
    pivotWeightKg: input.pivotWeightKg,
  });
}

export function validateAirDesk(input: AirDeskInput): string | null {
  if (!input.customer.trim()) return "Enter customer name.";
  if (!input.origin.trim()) return "Enter origin airport.";
  if (!input.destination.trim()) return "Enter destination airport.";
  const cargoErr = validateAirCargo(input.cargo);
  if (cargoErr) return cargoErr;
  if (!input.airline.trim()) return "Enter carrier / airline.";
  if (!input.routing.trim()) return "Enter routing.";
  if (!input.tt.trim()) return "Enter transit time.";
  if (!input.validity.trim()) return "Enter quote validity.";
  return null;
}
