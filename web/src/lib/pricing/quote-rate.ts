/** Prefer sell when set; otherwise use buy so drafting still shows real totals. */
export function quoteSideRate(sell: number, buy: number): number {
  if (sell > 0) return sell;
  if (buy > 0) return buy;
  return 0;
}
