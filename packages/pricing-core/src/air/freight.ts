import type { AirFreightInput, AirFreightResult } from "../types.js";
import { chargeableWeightKg, summarizeCargo } from "./cargo.js";
import { selectActiveBreakForSide } from "./breaks.js";

/**
 * Sell and buy freights are independent.
 * Buy rates must never inflate sell totals / GP when sell is still blank.
 */
export function calculateAirFreight(input: AirFreightInput): AirFreightResult {
  const dimUnit = input.dimUnit ?? "cms";
  const tariffsEnabled = input.tariffsEnabled ?? true;
  const weightBreaksEnabled = input.weightBreaksEnabled ?? true;
  const cargo = summarizeCargo(input.cargo, dimUnit);
  const chargeable = chargeableWeightKg(cargo, input.pivotWeightKg ?? 0);

  const sellSide = selectActiveBreakForSide(chargeable, input.breaks, "sell");
  const buySide = selectActiveBreakForSide(chargeable, input.breaks, "buy");

  let baseFreightSell =
    tariffsEnabled && weightBreaksEnabled ? chargeable * sellSide.rate : 0;
  let baseFreightBuy =
    tariffsEnabled && weightBreaksEnabled ? chargeable * buySide.rate : 0;
  let isMinActive = false;

  const minSell = input.breaks.min?.sell || 0;
  const minBuy = input.breaks.min?.buy || 0;

  if (tariffsEnabled && weightBreaksEnabled && minSell > 0 && baseFreightSell < minSell) {
    baseFreightSell = minSell;
    isMinActive = true;
  }
  if (tariffsEnabled && weightBreaksEnabled && minBuy > 0 && baseFreightBuy < minBuy) {
    baseFreightBuy = minBuy;
  }

  return {
    cargo,
    chargeableWeightKg: chargeable,
    usedBreak: isMinActive ? "min" : sellSide.rate > 0 ? sellSide.usedBreak : buySide.usedBreak,
    activeRate: sellSide.rate,
    activeBuyRate: buySide.rate,
    usingBuyFallback: sellSide.rate <= 0 && buySide.rate > 0,
    isMinActive,
    baseFreightSell,
    baseFreightBuy,
  };
}
