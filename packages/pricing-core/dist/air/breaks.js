export function getWeightBreakBracket(weightKg) {
    if (weightKg < 45)
        return "minus45";
    if (weightKg < 100)
        return "plus45";
    if (weightKg < 250)
        return "plus100";
    if (weightKg < 300)
        return "plus250";
    if (weightKg < 500)
        return "plus300";
    if (weightKg < 1000)
        return "plus500";
    return "plus1000";
}
/**
 * Legacy helper (tests / UI hints).
 * Quote totals must NOT use buy-as-sell — see selectActiveBreakForSide.
 */
export function resolveInterimRate(val) {
    if (typeof val === "number") {
        return { rate: val, isFallback: false };
    }
    if (!val)
        return { rate: 0, isFallback: false };
    const sell = val.sell || 0;
    const buy = val.buy || 0;
    if (sell > 0)
        return { rate: sell, isFallback: false };
    if (buy > 0)
        return { rate: buy, isFallback: true };
    return { rate: 0, isFallback: false };
}
function sideRate(val, side) {
    if (typeof val === "number")
        return side === "sell" ? val : 0;
    if (!val)
        return 0;
    return side === "sell" ? val.sell || 0 : val.buy || 0;
}
const BRACKET_LIMITS = [
    { name: "minus45", limit: 0 },
    { name: "plus45", limit: 45 },
    { name: "plus100", limit: 100 },
    { name: "plus250", limit: 250 },
    { name: "plus300", limit: 300 },
    { name: "plus500", limit: 500 },
    { name: "plus1000", limit: 1000 },
];
function bracketChoice(chargeableWeightKg, breaks, side) {
    const autoBreak = getWeightBreakBracket(chargeableWeightKg);
    const autoRate = sideRate(breaks[autoBreak], side);
    if (autoRate > 0)
        return { usedBreak: autoBreak, rate: autoRate };
    let best = null;
    for (const br of BRACKET_LIMITS) {
        if (sideRate(breaks[br.name], side) > 0 && chargeableWeightKg >= br.limit) {
            best = br;
        }
    }
    if (best)
        return { usedBreak: best.name, rate: sideRate(breaks[best.name], side) };
    const withRates = BRACKET_LIMITS.filter((br) => sideRate(breaks[br.name], side) > 0);
    if (withRates.length > 0) {
        return {
            usedBreak: withRates[0].name,
            rate: sideRate(breaks[withRates[0].name], side),
        };
    }
    return { usedBreak: autoBreak, rate: 0 };
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
export function selectActiveBreakForSide(chargeableWeightKg, breaks, side) {
    const base = bracketChoice(chargeableWeightKg, breaks, side);
    const plain = { ...base, billedWeightKg: chargeableWeightKg, advantage: false };
    if (!(base.rate > 0) || !(chargeableWeightKg > 0))
        return plain;
    const idx = BRACKET_LIMITS.findIndex((b) => b.name === base.usedBreak);
    if (idx < 0)
        return plain;
    for (const next of BRACKET_LIMITS.slice(idx + 1)) {
        const nextRate = sideRate(breaks[next.name], side);
        if (!(nextRate > 0))
            continue;
        if (next.limit > chargeableWeightKg && next.limit * nextRate < chargeableWeightKg * base.rate) {
            return { usedBreak: next.name, rate: nextRate, billedWeightKg: next.limit, advantage: true };
        }
        break; // only the next break that holds a rate is compared
    }
    return plain;
}
/** UI hint helper — display rate may still show buy when sell blank. */
export function selectActiveBreak(chargeableWeightKg, breaks) {
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
