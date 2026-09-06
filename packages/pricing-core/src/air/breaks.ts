import type { InterimRate, RatePair, WeightBreakName, WeightBreaks } from "../types.js";

export function getWeightBreakBracket(weightKg: number): WeightBreakName {
  if (weightKg < 45) return "minus45";
  if (weightKg < 100) return "plus45";
  if (weightKg < 300) return "plus100";
  if (weightKg < 500) return "plus300";
  if (weightKg < 1000) return "plus500";
  return "plus1000";
}

/**
 * Legacy helper (tests / UI hints).
 * Quote totals must NOT use buy-as-sell — see selectActiveBreakForSide.
 */
export function resolveInterimRate(val: RatePair | number | undefined): InterimRate {
  if (typeof val === "number") {
    return { rate: val, isFallback: false };
  }
  if (!val) return { rate: 0, isFallback: false };
  const sell = val.sell || 0;
  const buy = val.buy || 0;
  if (sell > 0) return { rate: sell, isFallback: false };
  if (buy > 0) return { rate: buy, isFallback: true };
  return { rate: 0, isFallback: false };
}

function sideRate(val: RatePair | number | undefined, side: "sell" | "buy"): number {
  if (typeof val === "number") return side === "sell" ? val : 0;
  if (!val) return 0;
  return side === "sell" ? val.sell || 0 : val.buy || 0;
}

const BRACKET_LIMITS: Array<{ name: WeightBreakName; limit: number }> = [
  { name: "minus45", limit: 0 },
  { name: "plus45", limit: 45 },
  { name: "plus100", limit: 100 },
  { name: "plus300", limit: 300 },
  { name: "plus500", limit: 500 },
  { name: "plus1000", limit: 1000 },
];

/** Active break using only sell OR only buy — money sides never cross. */
export function selectActiveBreakForSide(
  chargeableWeightKg: number,
  breaks: WeightBreaks,
  side: "sell" | "buy",
): { usedBreak: WeightBreakName; rate: number } {
  const autoBreak = getWeightBreakBracket(chargeableWeightKg);
  const autoRate = sideRate(breaks[autoBreak], side);
  if (autoRate > 0) return { usedBreak: autoBreak, rate: autoRate };

  let best: (typeof BRACKET_LIMITS)[number] | null = null;
  for (const br of BRACKET_LIMITS) {
    if (sideRate(breaks[br.name], side) > 0 && chargeableWeightKg >= br.limit) {
      best = br;
    }
  }
  if (best) return { usedBreak: best.name, rate: sideRate(breaks[best.name], side) };

  const withRates = BRACKET_LIMITS.filter((br) => sideRate(breaks[br.name], side) > 0);
  if (withRates.length > 0) {
    return {
      usedBreak: withRates[0].name,
      rate: sideRate(breaks[withRates[0].name], side),
    };
  }
  return { usedBreak: autoBreak, rate: 0 };
}

/** UI hint helper — display rate may still show buy when sell blank. */
export function selectActiveBreak(
  chargeableWeightKg: number,
  breaks: WeightBreaks,
): {
  usedBreak: WeightBreakName;
  activeRate: number;
  activeBuyRate: number;
  usingBuyFallback: boolean;
} {
  const sell = selectActiveBreakForSide(chargeableWeightKg, breaks, "sell");
  const buy = selectActiveBreakForSide(chargeableWeightKg, breaks, "buy");
  const usingBuyFallback = sell.rate <= 0 && buy.rate > 0;
  return {
    usedBreak: sell.rate > 0 ? sell.usedBreak : buy.usedBreak,
    activeRate: sell.rate > 0 ? sell.rate : buy.rate,
    activeBuyRate: buy.rate,
    usingBuyFallback,
  };
}
