const VOLUME_DIVISOR = {
    cms: 6000,
    inches: 366,
};
export function summarizeCargo(cargo, dimUnit = "cms") {
    const divisor = VOLUME_DIVISOR[dimUnit];
    let grossWeightKg = 0;
    let volumeWeightKg = 0;
    let volumeCbm = 0;
    let packageQty = 0;
    for (const line of cargo) {
        const { length: l, width: w, height: h, qty, grossWeightKg: gw } = line;
        if (l > 0 && w > 0 && h > 0 && qty > 0) {
            grossWeightKg += gw;
            packageQty += qty;
            volumeWeightKg += (l * w * h * qty) / divisor;
            volumeCbm +=
                dimUnit === "cms"
                    ? (l * w * h * qty) / 1000000
                    : l * w * h * qty * 0.0000163871;
        }
        else if (gw > 0) {
            // Gross-only line (e.g. pasted enquiry without full dimensions)
            grossWeightKg += gw;
            if (qty > 0)
                packageQty += qty;
        }
    }
    return { grossWeightKg, volumeWeightKg, volumeCbm, packageQty };
}
export function chargeableWeightKg(cargo, pivotWeightKg = 0) {
    return Math.max(cargo.grossWeightKg, cargo.volumeWeightKg, pivotWeightKg);
}
