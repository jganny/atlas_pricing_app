import type { EnquiryRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { gpNumeric } from "@/lib/quotes/edb-metrics";

/** Mid-market fallbacks used only when a quote has no amountINR / grossProfitINR. */
export const FX_TO_INR: Record<string, number> = {
  USD: 83.25,
  EUR: 90.5,
  GBP: 105.2,
  AED: 22.7,
  SGD: 62,
  INR: 1,
};

export function normalizeCurrency(code?: string | null): string {
  const c = (code || "USD").trim().toUpperCase();
  if (c === "RS" || c === "RUPEE" || c === "RUPEES" || c === "INDIAN RUPEE") return "INR";
  return c || "USD";
}

export function fxToInr(currency?: string | null): number {
  const cur = normalizeCurrency(currency);
  return FX_TO_INR[cur] ?? 83.25;
}

function toInr(amount: number, currency?: string | null): number {
  const cur = normalizeCurrency(currency);
  if (cur === "INR") return amount;
  return amount * fxToInr(cur);
}

/** Reporting sell in INR — prefer the stored rupee field, never stamp USD on it. */
export function sellAmountInr(row: Pick<EnquiryRecord, "amountINR" | "grandTotal" | "currency">): number {
  if (typeof row.amountINR === "number" && !Number.isNaN(row.amountINR)) return row.amountINR;
  const amount = row.grandTotal ?? 0;
  return toInr(amount, row.currency);
}

export function gpAmountInr(
  row: Pick<
    EnquiryRecord,
    "grossProfitINR" | "grossProfit" | "grossProfitCurrency" | "currency" | "grandTotal" | "buyTotal" | "buyRate" | "confirmedBuyRate"
  >,
): number {
  if (typeof row.grossProfitINR === "number" && !Number.isNaN(row.grossProfitINR)) {
    return row.grossProfitINR;
  }
  const gp = gpNumeric(row as EnquiryRecord);
  if (gp == null) return 0;
  return toInr(gp, row.grossProfitCurrency || row.currency);
}

export function formatQuoteAmount(
  amount: number | undefined | null,
  currency?: string | null,
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return formatCurrency(amount, normalizeCurrency(currency));
}

/** Quote currency first; INR equivalent when the job was not quoted in rupees. */
export function formatQuoteSell(row: EnquiryRecord): string {
  const cur = normalizeCurrency(row.currency);
  if (row.grandTotal == null && row.amountINR == null) return "—";
  if (row.grandTotal == null) return formatCurrency(row.amountINR || 0, "INR");
  const main = formatCurrency(row.grandTotal, cur);
  if (cur === "INR") return main;
  const inr = sellAmountInr(row);
  return `${main} · ${formatCurrency(inr, "INR")}`;
}

export function formatQuoteGp(row: EnquiryRecord): string {
  const gp = gpNumeric(row);
  if (gp == null) return "—";
  const cur = normalizeCurrency(row.grossProfitCurrency || row.currency);
  const main = formatCurrency(gp, cur);
  if (cur === "INR") return main;
  const inr = gpAmountInr(row);
  return `${main} · ${formatCurrency(inr, "INR")}`;
}

export function summarizeInr(rows: EnquiryRecord[]) {
  let sell = 0;
  let gp = 0;
  for (const row of rows) {
    sell += sellAmountInr(row);
    gp += gpAmountInr(row);
  }
  return { count: rows.length, sell, gp, buy: sell - gp };
}
