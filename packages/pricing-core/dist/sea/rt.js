export function seaChargeableRt(mode, grossWeightKg, volumeCbm, chargeableCbmOverride = 0) {
    const weightTons = grossWeightKg / 1000;
    // The 1 CBM minimum is an LCL-only convention (matches app-v4.js's own
    // isLclMode = (type === 'lcl')) — Break Bulk never gets floored, or a
    // sub-1-CBM BB shipment would be quoted higher than legacy would quote it.
    const effectiveCbm = mode === "lcl" && volumeCbm < 1 ? 1 : volumeCbm;
    if (chargeableCbmOverride > 0)
        return chargeableCbmOverride;
    return Math.max(effectiveCbm, weightTons);
}
