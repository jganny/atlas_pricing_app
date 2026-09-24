import { describe, expect, it } from "vitest";
import { calculateSeaFreight, seaChargeableRt } from "../index.js";

describe("seaChargeableRt", () => {
  it("floors LCL volume to 1 CBM minimum", () => {
    expect(seaChargeableRt("lcl", 200, 0.3)).toBe(1);
  });

  it("uses max of cbm and weight in tons", () => {
    expect(seaChargeableRt("lcl", 2500, 2)).toBe(2.5);
  });

  it("honours manual override", () => {
    expect(seaChargeableRt("lcl", 500, 2, 3.5)).toBe(3.5);
  });

  it("does NOT floor Break Bulk to 1 CBM — that's an LCL-only rule, matching legacy", () => {
    // Same inputs as the LCL 1-CBM-floor case above, but Break Bulk: true
    // volume (0.3) wins if it's the max against weight tons, never bumped to 1.
    expect(seaChargeableRt("bb", 200, 0.3)).toBeCloseTo(0.3, 5);
  });

  it("still uses weight tons for Break Bulk when it's the larger figure", () => {
    expect(seaChargeableRt("bb", 2500, 0.3)).toBe(2.5);
  });
});

describe("calculateSeaFreight", () => {
  it("sums FCL container lines", () => {
    const result = calculateSeaFreight({
      mode: "fcl",
      grossWeightKg: 10000,
      volumeCbm: 25,
      containers: [
        { type: "20'GP", qty: 2, sellRate: 800, buyRate: 700 },
        { type: "40'HC", qty: 1, sellRate: 1200, buyRate: 1000 },
      ],
    });
    expect(result.baseFreightSell).toBe(2800);
    expect(result.baseFreightBuy).toBe(2400);
    expect(result.containerCount).toBe(3);
  });

  it("multiplies LCL rate by chargeable RT", () => {
    const result = calculateSeaFreight({
      mode: "lcl",
      grossWeightKg: 800,
      volumeCbm: 2,
      lclRate: { sell: 45, buy: 40 },
    });
    expect(result.chargeableRt).toBe(2);
    expect(result.baseFreightSell).toBe(90);
  });

  it("keeps buy freight out of sell when sell is blank", () => {
    const result = calculateSeaFreight({
      mode: "lcl",
      grossWeightKg: 1000,
      volumeCbm: 1,
      lclRate: { sell: 0, buy: 50 },
    });
    expect(result.usingBuyFallback).toBe(true);
    expect(result.baseFreightSell).toBe(0);
    expect(result.baseFreightBuy).toBe(50);
  });
});
