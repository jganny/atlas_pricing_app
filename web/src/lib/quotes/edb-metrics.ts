import type { EnquiryRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export type BuySellMode = "total" | "perkg";
export type GpMode = "amount" | "percent";

export interface EdbMetricModes {
  buy: BuySellMode;
  sell: BuySellMode;
  gp: GpMode;
}

export const DEFAULT_EDB_METRIC_MODES: EdbMetricModes = {
  buy: "total",
  sell: "total",
  gp: "amount",
};

/** Prefer Sell − GP; fall back to stored buy fields. */
export function computeBuyTotal(row: EnquiryRecord): number | null {
  if (
    typeof row.grandTotal === "number" &&
    !Number.isNaN(row.grandTotal) &&
    typeof row.grossProfit === "number" &&
    !Number.isNaN(row.grossProfit)
  ) {
    return row.grandTotal - row.grossProfit;
  }
  if (typeof row.buyTotal === "number" && !Number.isNaN(row.buyTotal)) return row.buyTotal;
  if (typeof row.buyRate === "number" && !Number.isNaN(row.buyRate)) return row.buyRate;
  if (typeof row.confirmedBuyRate === "number" && !Number.isNaN(row.confirmedBuyRate)) {
    return row.confirmedBuyRate;
  }
  return null;
}

export function formatBuyCell(row: EnquiryRecord, mode: BuySellMode): string {
  const currency = row.currency || "USD";
  if (mode === "perkg") {
    const rate = row.appliedBuyRate;
    if (rate == null || Number.isNaN(rate)) return "—";
    if (row.usedBreak === "min") {
      return `${formatCurrency(rate, currency)} (Min)`;
    }
    const unit = row.mode === "sea" ? "/RT" : "/kg";
    return `${formatCurrency(rate, currency)}${unit}`;
  }
  const total = computeBuyTotal(row);
  return total == null ? "—" : formatCurrency(total, currency);
}

export function formatSellCell(row: EnquiryRecord, mode: BuySellMode): string {
  const currency = row.currency || "USD";
  if (mode === "perkg") {
    const rate = row.appliedRate;
    if (rate == null || Number.isNaN(rate)) return "—";
    if (row.usedBreak === "min") {
      return `${formatCurrency(rate, currency)} (Min)`;
    }
    const unit = row.mode === "sea" ? "/RT" : "/kg";
    return `${formatCurrency(rate, currency)}${unit}`;
  }
  if (row.grandTotal == null) return "—";
  const main = formatCurrency(row.grandTotal, currency);
  if (row.amountINR != null && currency !== "INR") {
    return `${main} · ₹${row.amountINR.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  return main;
}

export function formatGpCell(row: EnquiryRecord, mode: GpMode): string {
  const gp = row.grossProfit;
  const sell = row.grandTotal;
  if (mode === "percent") {
    if (gp == null || sell == null || !sell) return "—";
    return `${((gp / sell) * 100).toFixed(2)}%`;
  }
  if (gp == null) {
    const buy = computeBuyTotal(row);
    if (buy == null || sell == null) return "—";
    return formatCurrency(sell - buy, row.grossProfitCurrency || row.currency || "USD");
  }
  return formatCurrency(gp, row.grossProfitCurrency || row.currency || "USD");
}

export function gpNumeric(row: EnquiryRecord): number | null {
  if (typeof row.grossProfit === "number" && !Number.isNaN(row.grossProfit)) return row.grossProfit;
  const buy = computeBuyTotal(row);
  if (buy == null || row.grandTotal == null) return null;
  return row.grandTotal - buy;
}
