import { describe, expect, it } from "vitest";
import { calculateAirFreight, chargeableWeightKg, getWeightBreakBracket, resolveInterimRate, summarizeCargo, } from "../index.js";
describe("getWeightBreakBracket", () => {
    it("matches legacy bracket thresholds", () => {
        expect(getWeightBreakBracket(10)).toBe("minus45");
        expect(getWeightBreakBracket(45)).toBe("plus45");
        expect(getWeightBreakBracket(99)).toBe("plus45");
        expect(getWeightBreakBracket(100)).toBe("plus100");
        expect(getWeightBreakBracket(1000)).toBe("plus1000");
    });
});
describe("resolveInterimRate", () => {
    it("prefers sell over buy", () => {
        expect(resolveInterimRate({ sell: 5, buy: 3 })).toEqual({ rate: 5, isFallback: false });
    });
    it("falls back to buy when sell is zero", () => {
        expect(resolveInterimRate({ sell: 0, buy: 3 })).toEqual({ rate: 3, isFallback: true });
    });
});
describe("summarizeCargo", () => {
    it("computes volumetric weight with 6000 divisor (cms)", () => {
        const summary = summarizeCargo([
            { length: 100, width: 100, height: 100, qty: 1, grossWeightKg: 50 },
        ]);
        expect(summary.volumeWeightKg).toBeCloseTo(166.67, 1);
        expect(summary.grossWeightKg).toBe(50);
    });
    it("chargeable weight is max of gross and volumetric", () => {
        const cargo = summarizeCargo([
            { length: 100, width: 100, height: 100, qty: 1, grossWeightKg: 50 },
        ]);
        expect(chargeableWeightKg(cargo)).toBeCloseTo(166.67, 1);
    });
});
describe("calculateAirFreight", () => {
    it("applies per-kg rate for active break", () => {
        const result = calculateAirFreight({
            cargo: [{ length: 0, width: 0, height: 0, qty: 0, grossWeightKg: 120 }],
            breaks: {
                plus100: { sell: 2.5, buy: 2 },
                min: { sell: 0, buy: 0 },
            },
        });
        expect(result.usedBreak).toBe("plus100");
        expect(result.baseFreightSell).toBe(300);
        expect(result.chargeableWeightKg).toBe(120);
    });
    it("applies minimum flat when freight is below min sell", () => {
        const result = calculateAirFreight({
            cargo: [{ length: 0, width: 0, height: 0, qty: 0, grossWeightKg: 10 }],
            breaks: {
                minus45: { sell: 1, buy: 0.8 },
                min: { sell: 150, buy: 120 },
            },
        });
        expect(result.isMinActive).toBe(true);
        expect(result.baseFreightSell).toBe(150);
        expect(result.usedBreak).toBe("min");
    });
});
