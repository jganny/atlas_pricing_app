import type { SeaMode } from "../types.js";

export function seaChargeableRt(
  mode: SeaMode,
  grossWeightKg: number,
  volumeCbm: number,
  chargeableCbmOverride = 0,
): number {
  const weightTons = grossWeightKg / 1000;
  const effectiveCbm = mode !== "fcl" && volumeCbm < 1 ? 1 : volumeCbm;
  if (chargeableCbmOverride > 0) return chargeableCbmOverride;
  return Math.max(effectiveCbm, weightTons);
}
