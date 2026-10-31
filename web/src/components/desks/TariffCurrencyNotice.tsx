"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import type { CurrencyClash } from "@/lib/pricing/tariff-currency";

/**
 * Shown when a Circulars tariff is in a different currency from the quote. Its rates are NOT filled in (that would put a
 * dollar figure under a rupee label); the desk can switch the quote to the tariff's currency, which fills them.
 */
export function TariffCurrencyNotice({
  clashes,
  quoteCurrency,
  onSwitch,
  priced = false,
}: {
  clashes: CurrencyClash[];
  quoteCurrency: string;
  onSwitch: (currency: string) => void;
  /** True on desks that price straight from the tariff (Courier): saving pauses instead of rates being left out. */
  priced?: boolean;
}) {
  if (!clashes.length) return null;
  const currencies = [...new Set(clashes.map((c) => c.tariffCurrency))];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status" data-testid="tariff-currency-notice">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
      <span className="min-w-[14rem] flex-1">
        {clashes.map((c) => `${c.carrier} (${c.tariffCurrency})`).join(", ")}{" "}
        {priced
          ? `${clashes.length === 1 ? "is" : "are"} priced from a tariff in a different currency from this quote (${quoteCurrency}). Saving and preview are paused so those figures are not saved under the wrong currency. Switch the quote to match.`
          : `${clashes.length === 1 ? "has a Circulars tariff" : "have Circulars tariffs"} in a different currency from this quote (${quoteCurrency}), so ${clashes.length === 1 ? "its" : "their"} rates were not filled in. Enter the rate in ${quoteCurrency} yourself, or switch the quote.`}
      </span>
      {currencies.map((cur) => (
        <Button key={cur} type="button" size="sm" variant="secondary" onClick={() => onSwitch(cur)}>
          {priced ? `Quote in ${cur}` : `Quote in ${cur} and fill the rates`}
        </Button>
      ))}
    </div>
  );
}
