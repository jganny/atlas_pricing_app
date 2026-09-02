import { seaChargeableRt } from "./rt.js";
function activeRate(sell, buy) {
    if (sell > 0)
        return { rate: sell, isFallback: false };
    if (buy > 0)
        return { rate: buy, isFallback: true };
    return { rate: 0, isFallback: false };
}
export function calculateSeaFreight(input) {
    const tariffsEnabled = input.tariffsEnabled ?? true;
    const mode = input.mode;
    const chargeableRt = seaChargeableRt(mode, input.grossWeightKg, input.volumeCbm, input.chargeableCbmOverride);
    let baseFreightSell = 0;
    let baseFreightBuy = 0;
    let usingBuyFallback = false;
    const containerSummary = [];
    let containerCount = 0;
    if (mode === "fcl") {
        for (const c of input.containers ?? []) {
            const { rate, isFallback } = activeRate(c.sellRate, c.buyRate);
            if (isFallback)
                usingBuyFallback = true;
            if (c.qty > 0 && rate > 0 && tariffsEnabled) {
                baseFreightSell += c.qty * rate;
                baseFreightBuy += c.qty * c.buyRate;
                containerCount += c.qty;
                containerSummary.push(`${c.qty} x ${c.type}`);
            }
        }
    }
    else if (mode === "lcl") {
        const sell = input.lclRate?.sell ?? 0;
        const buy = input.lclRate?.buy ?? 0;
        const { rate, isFallback } = activeRate(sell, buy);
        usingBuyFallback = isFallback;
        if (tariffsEnabled) {
            baseFreightSell = chargeableRt * rate;
            baseFreightBuy = chargeableRt * buy;
        }
    }
    else {
        const sell = input.bbRate?.sell ?? 0;
        const buy = input.bbRate?.buy ?? 0;
        const { rate, isFallback } = activeRate(sell, buy);
        usingBuyFallback = isFallback;
        if (tariffsEnabled) {
            baseFreightSell = chargeableRt * rate;
            baseFreightBuy = chargeableRt * buy;
        }
    }
    return {
        chargeableRt,
        baseFreightSell,
        baseFreightBuy,
        usingBuyFallback,
        containerSummary,
        containerCount,
    };
}
