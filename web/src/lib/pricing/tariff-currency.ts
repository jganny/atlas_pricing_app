/**
 * A tariff's rates are only valid in the currency the tariff was published in. Dropping a USD rate into an INR quote
 * (or the other way round) puts the wrong number under the right label, so rates are filled only when the currencies agree.
 */
import { normalizeCurrency } from "@/lib/quotes/money";

export function sameCurrency(a: string | undefined | null, b: string | undefined | null): boolean {
  return normalizeCurrency(a) === normalizeCurrency(b);
}

export interface CurrencyClash {
  /** Who the tariff belongs to, e.g. "EK" or "Maersk". */
  carrier: string;
  /** The currency the tariff is published in. */
  tariffCurrency: string;
}

/** The carriers whose matching tariff is in a different currency from the quote, one entry per carrier. */
export function currencyClashes(
  matches: Array<{ carrier: string; tariffCurrency: string | undefined | null } | null | undefined>,
  quoteCurrency: string,
): CurrencyClash[] {
  const out = new Map<string, CurrencyClash>();
  for (const m of matches) {
    if (!m || !m.tariffCurrency || sameCurrency(m.tariffCurrency, quoteCurrency)) continue;
    const key = `${m.carrier.trim().toLowerCase()}|${normalizeCurrency(m.tariffCurrency)}`;
    if (!out.has(key)) out.set(key, { carrier: m.carrier, tariffCurrency: normalizeCurrency(m.tariffCurrency) });
  }
  return [...out.values()];
}
