export function seaChargeableRt(mode, grossWeightKg, volumeCbm, chargeableCbmOverride = 0) {
    const weightTons = grossWeightKg / 1000;
    const effectiveCbm = mode !== "fcl" && volumeCbm < 1 ? 1 : volumeCbm;
    if (chargeableCbmOverride > 0)
        return chargeableCbmOverride;
    return Math.max(effectiveCbm, weightTons);
}
