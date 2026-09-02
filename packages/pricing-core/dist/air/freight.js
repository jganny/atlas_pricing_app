import { chargeableWeightKg, summarizeCargo } from "./cargo.js";
import { resolveInterimRate, selectActiveBreak } from "./breaks.js";
export function calculateAirFreight(input) {
    const dimUnit = input.dimUnit ?? "cms";
    const tariffsEnabled = input.tariffsEnabled ?? true;
    const weightBreaksEnabled = input.weightBreaksEnabled ?? true;
    const cargo = summarizeCargo(input.cargo, dimUnit);
    const chargeable = chargeableWeightKg(cargo, input.pivotWeightKg ?? 0);
    const { usedBreak, activeRate, activeBuyRate, usingBuyFallback } = selectActiveBreak(chargeable, input.breaks);
    let baseFreightSell = tariffsEnabled && weightBreaksEnabled ? chargeable * activeRate : 0;
    let baseFreightBuy = tariffsEnabled && weightBreaksEnabled ? chargeable * activeBuyRate : 0;
    let isMinActive = false;
    let minFallback = false;
    const minVal = input.breaks.min;
    const minResolved = resolveInterimRate(minVal);
    const minSell = minResolved.rate;
    const minBuy = minVal?.buy ?? 0;
    if (tariffsEnabled && weightBreaksEnabled && minSell > 0 && baseFreightSell < minSell) {
        baseFreightSell = minSell;
        baseFreightBuy = minBuy;
        isMinActive = true;
        minFallback = minResolved.isFallback;
    }
    return {
        cargo,
        chargeableWeightKg: chargeable,
        usedBreak: isMinActive ? "min" : usedBreak,
        activeRate,
        activeBuyRate,
        usingBuyFallback: usingBuyFallback || minFallback,
        isMinActive,
        baseFreightSell,
        baseFreightBuy,
    };
}
