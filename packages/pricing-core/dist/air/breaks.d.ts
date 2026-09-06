import type { InterimRate, RatePair, WeightBreakName, WeightBreaks } from "../types.js";
export declare function getWeightBreakBracket(weightKg: number): WeightBreakName;
/**
 * Legacy helper (tests / UI hints).
 * Quote totals must NOT use buy-as-sell — see selectActiveBreakForSide.
 */
export declare function resolveInterimRate(val: RatePair | number | undefined): InterimRate;
/** Active break using only sell OR only buy — money sides never cross. */
export declare function selectActiveBreakForSide(chargeableWeightKg: number, breaks: WeightBreaks, side: "sell" | "buy"): {
    usedBreak: WeightBreakName;
    rate: number;
};
/** UI hint helper — display rate may still show buy when sell blank. */
export declare function selectActiveBreak(chargeableWeightKg: number, breaks: WeightBreaks): {
    usedBreak: WeightBreakName;
    activeRate: number;
    activeBuyRate: number;
    usingBuyFallback: boolean;
};
//# sourceMappingURL=breaks.d.ts.map