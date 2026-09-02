import type { InterimRate, RatePair, WeightBreakName, WeightBreaks } from "../types.js";
export declare function getWeightBreakBracket(weightKg: number): WeightBreakName;
/** Mirrors legacy resolveInterimRate — sell preferred, buy as interim fallback. */
export declare function resolveInterimRate(val: RatePair | number | undefined): InterimRate;
export declare function selectActiveBreak(chargeableWeightKg: number, breaks: WeightBreaks): {
    usedBreak: WeightBreakName;
    activeRate: number;
    activeBuyRate: number;
    usingBuyFallback: boolean;
};
//# sourceMappingURL=breaks.d.ts.map