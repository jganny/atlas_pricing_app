import type { SeaFreightInput, SeaFreightResult } from "../types.js";
import { seaChargeableRt } from "./rt.js";

/** Sell and buy are independent — never use buy as a sell stand-in for totals/GP. */
export function calculateSeaFreight(input: SeaFreightInput): SeaFreightResult {
  const tariffsEnabled = input.tariffsEnabled ?? true;
  const mode = input.mode;
  const chargeableRt = seaChargeableRt(
    mode,
    input.grossWeightKg,
    input.volumeCbm,
    input.chargeableCbmOverride,
  );

  let baseFreightSell = 0;
  let baseFreightBuy = 0;
  let usingBuyFallback = false;
  const containerSummary: string[] = [];
  let containerCount = 0;

  if (mode === "fcl") {
    for (const c of input.containers ?? []) {
      if (c.qty <= 0) continue;
      const sell = c.sellRate || 0;
      const buy = c.buyRate || 0;
      if (sell <= 0 && buy > 0) usingBuyFallback = true;
      if (tariffsEnabled) {
        if (sell > 0) {
          baseFreightSell += c.qty * sell;
          containerCount += c.qty;
          containerSummary.push(`${c.qty} x ${c.type}`);
        } else if (buy > 0) {
          // still count containers for summary when only buy is known
          containerCount += c.qty;
          containerSummary.push(`${c.qty} x ${c.type}`);
        }
        if (buy > 0) baseFreightBuy += c.qty * buy;
      }
    }
  } else if (mode === "lcl") {
    const sell = input.lclRate?.sell ?? 0;
    const buy = input.lclRate?.buy ?? 0;
    if (sell <= 0 && buy > 0) usingBuyFallback = true;
    if (tariffsEnabled) {
      baseFreightSell = chargeableRt * sell;
      baseFreightBuy = chargeableRt * buy;
    }
  } else {
    const sell = input.bbRate?.sell ?? 0;
    const buy = input.bbRate?.buy ?? 0;
    if (sell <= 0 && buy > 0) usingBuyFallback = true;
    if (tariffsEnabled) {
      baseFreightSell = chargeableRt * sell;
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
