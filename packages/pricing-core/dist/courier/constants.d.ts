import type { CourierDimUnit, CourierPackageLine, CourierServiceKey } from "../types.js";
export declare const DIM_DIVISOR_CM = 5000;
export declare const DIM_DIVISOR_IN = 139;
export declare const SERVICE_LEVELS: Record<CourierServiceKey, {
    label: string;
    factor: number;
    transit: string;
}>;
export declare const COURIER_CARRIERS: readonly [{
    readonly id: "dhl";
    readonly name: "DHL Express";
    readonly color: "#FFCC00";
}, {
    readonly id: "fedex";
    readonly name: "FedEx International";
    readonly color: "#4D148C";
}, {
    readonly id: "ups";
    readonly name: "UPS Worldwide";
    readonly color: "#351C15";
}, {
    readonly id: "aramex";
    readonly name: "Aramex";
    readonly color: "#E31937";
}, {
    readonly id: "bluedart";
    readonly name: "Blue Dart";
    readonly color: "#003DA5";
}, {
    readonly id: "dtdc";
    readonly name: "DTDC";
    readonly color: "#ED1C24";
}];
export declare const CARRIER_FACTORS: Record<string, number>;
export declare const ZONE_TABLE: Record<string, Record<string, number>>;
export declare const ZONE_RATES: Record<number, {
    min: number;
    breaks: Array<{
        w: number;
        r: number;
    }>;
}>;
export declare const DEFAULT_EXCHANGE_RATES: {
    USD_TO_INR: number;
    EUR_TO_USD: number;
    GBP_TO_USD: number;
    USD_TO_AED: number;
    USD_TO_SGD: number;
    USD_TO_AUD: number;
    USD_TO_CNY: number;
};
export declare function roundChargeableKg(w: number): number;
export declare function getCourierZone(originCountry: string, destCountry: string): number;
export declare function getRatePerKg(chargeableKg: number, zone: number): {
    ratePerKg: number;
    minCharge: number;
};
export declare function summarizeCourierPackages(packages: CourierPackageLine[], dimUnit?: CourierDimUnit): {
    lines: {
        qty: number;
        volPerPiece: number;
        chargeable: number;
        gw?: number;
        l?: number;
        w?: number;
        h?: number;
    }[];
    chargeableKg: number;
    oversized: boolean;
};
export declare function convertFromUsd(amountUsd: number, currency: string, rates?: {
    USD_TO_INR: number;
    EUR_TO_USD: number;
    GBP_TO_USD: number;
    USD_TO_AED: number;
    USD_TO_SGD: number;
    USD_TO_AUD: number;
    USD_TO_CNY: number;
}): number;
//# sourceMappingURL=constants.d.ts.map