export function getWeightBreakBracket(weightKg) {
    if (weightKg < 45)
        return "minus45";
    if (weightKg < 100)
        return "plus45";
    if (weightKg < 300)
        return "plus100";
    if (weightKg < 500)
        return "plus300";
    if (weightKg < 1000)
        return "plus500";
    return "plus1000";
}
/** Mirrors legacy resolveInterimRate — sell preferred, buy as interim fallback. */
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
const BRACKET_LIMITS = [
    { name: "minus45", limit: 0 },
    { name: "plus45", limit: 45 },
    { name: "plus100", limit: 100 },
    { name: "plus300", limit: 300 },
    { name: "plus500", limit: 500 },
    { name: "plus1000", limit: 1000 },
];
export function selectActiveBreak(chargeableWeightKg, breaks) {
    const autoBreak = getWeightBreakBracket(chargeableWeightKg);
    const autoVal = breaks[autoBreak];
    const autoResolved = resolveInterimRate(autoVal);
    if (autoResolved.rate > 0) {
        return {
            usedBreak: autoBreak,
            activeRate: autoResolved.rate,
            activeBuyRate: autoVal?.buy ?? 0,
            usingBuyFallback: autoResolved.isFallback,
        };
    }
    let best = null;
    for (const br of BRACKET_LIMITS) {
        const val = breaks[br.name];
        if (resolveInterimRate(val).rate > 0 && chargeableWeightKg >= br.limit) {
            best = br;
        }
    }
    if (best) {
        const val = breaks[best.name];
        const resolved = resolveInterimRate(val);
        return {
            usedBreak: best.name,
            activeRate: resolved.rate,
            activeBuyRate: val?.buy ?? 0,
            usingBuyFallback: resolved.isFallback,
        };
    }
    const withRates = BRACKET_LIMITS.filter((br) => resolveInterimRate(breaks[br.name]).rate > 0);
    if (withRates.length > 0) {
        const val = breaks[withRates[0].name];
        const resolved = resolveInterimRate(val);
        return {
            usedBreak: withRates[0].name,
            activeRate: resolved.rate,
            activeBuyRate: val?.buy ?? 0,
            usingBuyFallback: resolved.isFallback,
        };
    }
    return {
        usedBreak: autoBreak,
        activeRate: 0,
        activeBuyRate: 0,
        usingBuyFallback: false,
    };
}
