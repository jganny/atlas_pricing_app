import { describe, expect, it } from "vitest";
import { calculateAirFreight, chargeableWeightKg, getWeightBreakBracket, resolveInterimRate, summarizeCargo, } from "../index.js";
describe("getWeightBreakBracket", () => {
    it("matches legacy bracket thresholds", () => {
        expect(getWeightBreakBracket(10)).toBe("minus45");
        expect(getWeightBreakBracket(45)).toBe("plus45");
        expect(getWeightBreakBracket(99)).toBe("plus45");
        expect(getWeightBreakBracket(100)).toBe("plus100");
        expect(getWeightBreakBracket(249)).toBe("plus100");
        expect(getWeightBreakBracket(250)).toBe("plus250");
        expect(getWeightBreakBracket(299)).toBe("plus250");
        expect(getWeightBreakBracket(300)).toBe("plus300");
        expect(getWeightBreakBracket(500)).toBe("plus500");
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
    it("500 kg × $1.50 sell = $750 base (practical quote math)", () => {
        const result = calculateAirFreight({
            cargo: [{ length: 0, width: 0, height: 0, qty: 0, grossWeightKg: 500 }],
            breaks: {
                plus500: { sell: 1.5, buy: 1.2 },
                min: { sell: 0, buy: 0 },
            },
        });
        expect(result.usedBreak).toBe("plus500");
        expect(result.chargeableWeightKg).toBe(500);
        expect(result.baseFreightSell).toBe(750);
        expect(result.baseFreightBuy).toBe(600);
    });
    it("does not put buy freight into sell when sell is blank", () => {
        const result = calculateAirFreight({
            cargo: [{ length: 0, width: 0, height: 0, qty: 0, grossWeightKg: 500 }],
            breaks: {
                plus500: { sell: 0, buy: 1.5 },
                min: { sell: 0, buy: 0 },
            },
        });
        expect(result.baseFreightSell).toBe(0);
        expect(result.baseFreightBuy).toBe(750);
        expect(result.usingBuyFallback).toBe(true);
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
describe("weight-break advantage (breakeven)", () => {
    const freight = (kg, breaks) => calculateAirFreight({ cargo: [{ length: 0, width: 0, height: 0, qty: 0, grossWeightKg: kg }], breaks });
    // +100 at 5.2 and +300 at 4.9: breakeven = 4.9 x 300 / 5.2 = 282.7 kg
    const card = { plus100: { sell: 5.2, buy: 4.4 }, plus300: { sell: 4.9, buy: 4.1 } };
    it("stays on the current break below the breakeven weight (250 kg stays on +100)", () => {
        const r = freight(250, card);
        expect(r.usedBreak).toBe("plus100");
        expect(r.billedWeightKg).toBe(250);
        expect(r.weightBreakAdvantage).toBe(false);
        expect(r.baseFreightSell).toBeCloseTo(1300, 5);
    });
    it("is billed on the next break's start weight above the breakeven weight (290 kg -> 300 kg at +300)", () => {
        const r = freight(290, card);
        expect(r.usedBreak).toBe("plus300");
        expect(r.billedWeightKg).toBe(300);
        expect(r.weightBreakAdvantage).toBe(true);
        expect(r.chargeableWeightKg).toBe(290);
        expect(r.baseFreightSell).toBeCloseTo(1470, 5);
        expect(r.baseFreightBuy).toBeCloseTo(1230, 5);
        // billing 290 kg at +100 would have cost 1508
        expect(r.baseFreightSell).toBeLessThan(290 * 5.2);
    });
    it("is exactly level at the breakeven weight and keeps the current break", () => {
        const r = freight(282.7, { plus100: { sell: 5.2, buy: 0 }, plus300: { sell: 4.9, buy: 0 } });
        // 282.7 x 5.2 = 1470.04, a hair above 1470, so the next break wins by a cent
        expect(r.usedBreak).toBe("plus300");
        const tie = freight(300 * 4 / 5, { plus100: { sell: 5, buy: 0 }, plus300: { sell: 4, buy: 0 } }); // 240 x 5 = 1200 = 300 x 4
        expect(tie.usedBreak).toBe("plus100");
        expect(tie.weightBreakAdvantage).toBe(false);
    });
    it("a tariff with a +250 rate uses it directly from 250 kg, and compares it with +300 above", () => {
        const withSeries = { ...card, plus250: { sell: 5.0, buy: 4.2 } };
        expect(freight(250, withSeries).usedBreak).toBe("plus250");
        expect(freight(250, withSeries).baseFreightSell).toBeCloseTo(1250, 5);
        // +250 at 5.0, +300 at 4.9: breakeven 294 kg
        expect(freight(290, withSeries).usedBreak).toBe("plus250");
        expect(freight(296, withSeries).usedBreak).toBe("plus300");
        expect(freight(296, withSeries).billedWeightKg).toBe(300);
    });
    it("without a +250 rate, 250-299 kg compares +100 with +300 directly", () => {
        expect(freight(270, card).usedBreak).toBe("plus100");
        expect(freight(285, card).usedBreak).toBe("plus300");
    });
    it("sell and buy sides decide independently", () => {
        // sell breakeven 4.9*300/5.2=282.7; buy: 3.0*300/4.4 = 204.5
        const r = freight(250, { plus100: { sell: 5.2, buy: 4.4 }, plus300: { sell: 4.9, buy: 3.0 } });
        expect(r.baseFreightSell).toBeCloseTo(1300, 5);
        expect(r.baseFreightBuy).toBeCloseTo(900, 5);
        expect(r.usedBreak).toBe("plus100");
    });
    it("needs a rate on the next break; with none, nothing changes", () => {
        const r = freight(290, { plus100: { sell: 5.2, buy: 4.4 } });
        expect(r.usedBreak).toBe("plus100");
        expect(r.billedWeightKg).toBe(290);
    });
});
