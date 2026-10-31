/**
 * Gross profit on a Courier quote: what the customer pays for the freight, less what the carrier charges us for it.
 * GST, fuel and add-ons are left out, since they pass straight through. If any quoted lane has no buy figure
 * the profit is unknown (null) and is left blank, rather than saved as a misleading 0.
 */
export interface CourierGpRow {
  /** Sell-side freight (before fuel, extras and GST). */
  base: number;
  /** The carrier's cost for the same freight. */
  buy: number;
}

export function courierGrossProfit(rows: Array<CourierGpRow | undefined | null>): number | null {
  const quoted = rows.filter((r): r is CourierGpRow => Boolean(r));
  if (!quoted.length) return null;
  if (quoted.some((r) => !(r.buy > 0) || !(r.base > 0))) return null;
  return Math.round(quoted.reduce((sum, r) => sum + (r.base - r.buy), 0) * 100) / 100;
}
