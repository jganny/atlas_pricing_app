/**
 * What a currency is worth in rupees, for the INR figure saved with a quote (Enquiry DB reporting). The customer's total is never touched.
 * Order: a rate the person typed in always wins; else the live market rate for THAT currency; else an approximate fallback for the common ones;
 * else there is no rate, and the desk asks for one instead of guessing (a wrong rupee figure in the reports is worse than a question).
 */
export type FxSource = "typed" | "live" | "approximate" | "none";

/** Rough mid-market values, used only when the live rate cannot be fetched. Marked "approximate" wherever they are shown. */
export const FALLBACK_INR: Record<string, number> = {
  INR: 1, USD: 83.5, EUR: 90.5, GBP: 105.2, AED: 22.7, SGD: 62, JPY: 0.56, CNY: 11.6, AUD: 55, CAD: 61, CHF: 94, SAR: 22.3, QAR: 22.9,
  KWD: 272, OMR: 217, BHD: 221.5, THB: 2.4, MYR: 18.5, HKD: 10.7, ZAR: 4.6, TRY: 2.5, NZD: 50, SEK: 8, NOK: 7.8, DKK: 12.1, KRW: 0.062,
  IDR: 0.0053, VND: 0.0033, PKR: 0.3, BDT: 0.7, LKR: 0.28, NPR: 0.63, EGP: 1.7, BRL: 15, MXN: 4.6, PLN: 21, CZK: 3.7, HUF: 0.23,
  RUB: 0.9, ILS: 23, JOD: 118, KES: 0.65, NGN: 0.055, PHP: 1.45, TWD: 2.6,
};

export interface InrRate {
  rate: number | null;
  source: FxSource;
}

/** The rupee value of one unit of a currency. live: rupees per unit for many currencies (from the rate service). */
export function resolveInrRate(input: { currency: string; customFx?: number; live?: Record<string, number> | null }): InrRate {
  const cur = String(input.currency || "").trim().toUpperCase();
  if (!cur) return { rate: null, source: "none" };
  if (cur === "INR") return { rate: 1, source: "live" };
  if (input.customFx && input.customFx > 0 && Number.isFinite(input.customFx)) return { rate: input.customFx, source: "typed" };
  const live = input.live?.[cur];
  if (live && live > 0 && Number.isFinite(live)) return { rate: live, source: "live" };
  const fb = FALLBACK_INR[cur];
  if (fb) return { rate: fb, source: "approximate" };
  return { rate: null, source: "none" };
}

/** Plain words for the line under the rate box. */
export function fxSourceText(r: InrRate, currency: string): string {
  if (r.source === "typed") return "the rate you typed";
  if (r.source === "live") return `today's market rate for ${currency}`;
  if (r.source === "approximate") return `an approximate rate for ${currency} (the live rate could not be fetched): type the rate to be exact`;
  return `no rate is known for ${currency}: type the rate`;
}

/** The service answers "units of each currency per 1 INR"; we need rupees per unit. */
export function inrPerUnitFrom(perInr: Record<string, number> | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, perOne] of Object.entries(perInr ?? {})) if (typeof perOne === "number" && perOne > 0 && Number.isFinite(perOne)) out[code] = 1 / perOne;
  return out;
}
