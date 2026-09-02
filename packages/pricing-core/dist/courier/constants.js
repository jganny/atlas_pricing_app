export const DIM_DIVISOR_CM = 5000;
export const DIM_DIVISOR_IN = 139;
export const SERVICE_LEVELS = {
    express: { label: "Express (T+1–2)", factor: 1.35, transit: "1–2 business days" },
    economy: { label: "Economy (T+3–5)", factor: 1.0, transit: "3–5 business days" },
    same_day: { label: "Same Day (domestic)", factor: 1.85, transit: "Same day cut-off 14:00" },
    document: { label: "Document Express", factor: 0.72, transit: "1–3 business days" },
};
export const COURIER_CARRIERS = [
    { id: "dhl", name: "DHL Express", color: "#FFCC00" },
    { id: "fedex", name: "FedEx International", color: "#4D148C" },
    { id: "ups", name: "UPS Worldwide", color: "#351C15" },
    { id: "aramex", name: "Aramex", color: "#E31937" },
    { id: "bluedart", name: "Blue Dart", color: "#003DA5" },
    { id: "dtdc", name: "DTDC", color: "#ED1C24" },
];
export const CARRIER_FACTORS = {
    dhl: 1.05,
    fedex: 1.08,
    ups: 1.06,
    aramex: 0.92,
    bluedart: 0.78,
    dtdc: 0.72,
};
export const ZONE_TABLE = {
    IN: { IN: 1, AE: 2, SG: 3, GB: 4, US: 5, DE: 4, AU: 5, CN: 3, HK: 3, default: 6 },
    AE: { IN: 2, AE: 1, GB: 3, US: 4, DE: 3, SG: 3, default: 5 },
    US: { US: 1, CA: 2, GB: 3, DE: 3, IN: 5, AE: 4, default: 6 },
    GB: { GB: 1, DE: 2, FR: 2, US: 3, IN: 4, AE: 3, default: 5 },
    default: { default: 5 },
};
export const ZONE_RATES = {
    1: { min: 8, breaks: [{ w: 0.5, r: 18 }, { w: 5, r: 12 }, { w: 30, r: 8.5 }, { w: 100, r: 6.2 }, { w: 9999, r: 5.1 }] },
    2: { min: 12, breaks: [{ w: 0.5, r: 22 }, { w: 5, r: 14 }, { w: 30, r: 9.8 }, { w: 100, r: 7.1 }, { w: 9999, r: 5.8 }] },
    3: { min: 15, breaks: [{ w: 0.5, r: 26 }, { w: 5, r: 16 }, { w: 30, r: 11 }, { w: 100, r: 8.2 }, { w: 9999, r: 6.5 }] },
    4: { min: 18, breaks: [{ w: 0.5, r: 32 }, { w: 5, r: 19 }, { w: 30, r: 13 }, { w: 100, r: 9.5 }, { w: 9999, r: 7.2 }] },
    5: { min: 22, breaks: [{ w: 0.5, r: 38 }, { w: 5, r: 22 }, { w: 30, r: 15 }, { w: 100, r: 11 }, { w: 9999, r: 8.4 }] },
    6: { min: 28, breaks: [{ w: 0.5, r: 45 }, { w: 5, r: 26 }, { w: 30, r: 18 }, { w: 100, r: 13 }, { w: 9999, r: 9.8 }] },
};
export const DEFAULT_EXCHANGE_RATES = {
    USD_TO_INR: 83,
    EUR_TO_USD: 1.08,
    GBP_TO_USD: 1.25,
    USD_TO_AED: 0.27,
    USD_TO_SGD: 0.74,
    USD_TO_AUD: 0.65,
    USD_TO_CNY: 0.14,
};
export function roundChargeableKg(w) {
    if (w <= 0)
        return 0;
    return Math.ceil(w * 2) / 2;
}
export function getCourierZone(originCountry, destCountry) {
    const o = (originCountry || "IN").toUpperCase().slice(0, 2);
    const d = (destCountry || "IN").toUpperCase().slice(0, 2);
    const row = ZONE_TABLE[o] || ZONE_TABLE.default;
    return row[d] || row.default || 6;
}
export function getRatePerKg(chargeableKg, zone) {
    const z = ZONE_RATES[zone] || ZONE_RATES[6];
    let rate = z.breaks[z.breaks.length - 1].r;
    for (const br of z.breaks) {
        if (chargeableKg <= br.w) {
            rate = br.r;
            break;
        }
    }
    return { ratePerKg: rate, minCharge: z.min };
}
export function summarizeCourierPackages(packages, dimUnit = "cm") {
    const divisor = dimUnit === "in" ? DIM_DIVISOR_IN : DIM_DIVISOR_CM;
    const lines = packages.map((p) => {
        const qty = p.qty || 1;
        const gw = p.gw || 0;
        const l = p.l || 0;
        const w = p.w || 0;
        const h = p.h || 0;
        const volPerPiece = (l * w * h) / divisor;
        const chargeablePerPiece = Math.max(gw, volPerPiece);
        const chargeable = roundChargeableKg(chargeablePerPiece) * qty;
        return { ...p, qty, volPerPiece, chargeable };
    });
    const total = roundChargeableKg(lines.reduce((s, p) => s + p.chargeable, 0));
    const oversized = lines.some((p) => Math.max(p.l || 0, p.w || 0, p.h || 0) > 120 || (p.l || 0) + (p.w || 0) + (p.h || 0) > 300);
    return { lines, chargeableKg: total, oversized };
}
export function convertFromUsd(amountUsd, currency, rates = DEFAULT_EXCHANGE_RATES) {
    if (currency === "USD")
        return amountUsd;
    if (currency === "INR")
        return amountUsd * rates.USD_TO_INR;
    if (currency === "EUR")
        return amountUsd / rates.EUR_TO_USD;
    if (currency === "GBP")
        return amountUsd / rates.GBP_TO_USD;
    if (currency === "AED")
        return amountUsd / rates.USD_TO_AED;
    if (currency === "SGD")
        return amountUsd / rates.USD_TO_SGD;
    if (currency === "AUD")
        return amountUsd / rates.USD_TO_AUD;
    if (currency === "CNY")
        return amountUsd / rates.USD_TO_CNY;
    return amountUsd * rates.USD_TO_INR;
}
