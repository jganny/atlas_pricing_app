import type { InterimRate, RatePair, WeightBreakName, WeightBreaks } from "../types.js";
export declare function getWeightBreakBracket(weightKg: number): WeightBreakName;
/**
 * Legacy helper (tests / UI hints).
 * Quote totals must NOT use buy-as-sell — see selectActiveBreakForSide.
 */
export declare function resolveInterimRate(val: RatePair | number | undefined): InterimRate;
export interface ActiveBreak {
    usedBreak: WeightBreakName;
    rate: number;
    /** The weight the freight is billed on: the chargeable weight, or a higher break's starting weight when that is cheaper. */
    billedWeightKg: number;
    /** True when a higher break was chosen because it costs less (weight-break advantage). */
    advantage: boolean;
}
/**
 * Active break using only sell OR only buy — money sides never cross.
 *
 * Weight-break advantage: a shipment just below a break can cost less if it is billed at the next break's rate on that break's
 * starting weight. Breakeven weight = (next rate x next start weight) / current rate. If the shipment weighs more than the breakeven
 * weight the next break is cheaper and is used (billed on its start weight); otherwise the current break stays. Example: +100 at
 * 5.2 and +300 at 4.9 give a breakeven of 282.7 kg, so 250 kg stays on +100 and 290 kg is billed as 300 kg at 4.9. The next break
 * is the next higher one that holds a rate, so a tariff without +250 compares +100 with +300 directly. Equal totals keep the
 * current break.
 */
export declare function selectActiveBreakForSide(chargeableWeightKg: number, breaks: WeightBreaks, side: "sell" | "buy"): ActiveBreak;
/** UI hint helper — display rate may still show buy when sell blank. */
export declare function selectActiveBreak(chargeableWeightKg: number, breaks: WeightBreaks): {
    usedBreak: WeightBreakName;
    activeRate: number;
    activeBuyRate: number;
    usingBuyFallback: boolean;
};
//# sourceMappingURL=breaks.d.ts.map