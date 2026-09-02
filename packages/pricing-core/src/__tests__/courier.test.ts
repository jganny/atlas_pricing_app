import { describe, expect, it } from "vitest";
import {
  calculateCourierFreight,
  getCourierZone,
  roundChargeableKg,
  summarizeCourierPackages,
} from "../index.js";

describe("courier zone & chargeable", () => {
  it("rounds chargeable to nearest 0.5 kg", () => {
    expect(roundChargeableKg(10.2)).toBe(10.5);
  });

  it("domestic IN lane is zone 1", () => {
    expect(getCourierZone("IN", "IN")).toBe(1);
  });

  it("computes volumetric per piece with 5000 divisor", () => {
    const { chargeableKg } = summarizeCourierPackages([
      { qty: 1, gw: 2, l: 50, w: 40, h: 30 },
    ]);
    expect(chargeableKg).toBe(12);
  });
});

describe("calculateCourierFreight", () => {
  it("returns sorted carrier quotes and total with GST", () => {
    const result = calculateCourierFreight({
      packages: [{ qty: 1, gw: 5, l: 30, w: 20, h: 15 }],
      originCountry: "IN",
      destCountry: "AE",
      service: "economy",
      currency: "USD",
      marginPct: 10,
      selectedCarrierId: "dhl",
      gstEnabled: true,
      surcharges: {
        fuelPct: 18,
        remote: false,
        remoteAmount: 450,
        residential: false,
        residentialAmount: 350,
        saturday: false,
        saturdayAmount: 500,
        dg: false,
        dgAmount: 1200,
        insurance: false,
        insurancePct: 1.5,
        declaredValue: 0,
        oversized: false,
        oversizedAmount: 800,
      },
    });
    expect(result.quotes.length).toBe(6);
    expect(result.chosen?.id).toBe("dhl");
    expect(result.total).toBeGreaterThan(result.subtotal);
    expect(result.tax).toBeCloseTo(result.subtotal * 0.18, 2);
  });
});
