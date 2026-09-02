import type {
  CourierCarrierQuote,
  CourierFreightInput,
  CourierFreightResult,
  CourierSurchargeInput,
} from "../types.js";
import {
  CARRIER_FACTORS,
  COURIER_CARRIERS,
  SERVICE_LEVELS,
  convertFromUsd,
  getCourierZone,
  getRatePerKg,
  summarizeCourierPackages,
} from "./constants.js";

function buildCarrierQuotes(
  chargeableKg: number,
  zone: number,
  serviceKey: CourierFreightInput["service"],
  currency: string,
  marginPct: number,
): CourierCarrierQuote[] {
  const svc = SERVICE_LEVELS[serviceKey] || SERVICE_LEVELS.economy;
  const isDoc = serviceKey === "document";
  const rateInfo = getRatePerKg(isDoc ? Math.max(chargeableKg, 0.5) : chargeableKg, zone);

  const quotes = COURIER_CARRIERS.map((c) => {
    const factor = (CARRIER_FACTORS[c.id] || 1) * svc.factor;
    const baseUsd = isDoc
      ? Math.max(rateInfo.minCharge * factor, rateInfo.ratePerKg * factor * 0.5)
      : Math.max(rateInfo.minCharge * factor, rateInfo.ratePerKg * factor * chargeableKg);
    const sellUsd = baseUsd * (1 + marginPct / 100);
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      buyUsd: baseUsd,
      sellUsd,
      buyLocal: convertFromUsd(baseUsd, currency),
      sellLocal: convertFromUsd(sellUsd, currency),
      ratePerKg: rateInfo.ratePerKg * factor,
      transit: svc.transit,
    };
  });

  return quotes.sort((a, b) => a.sellLocal - b.sellLocal);
}

function calcSurcharges(baseFreight: number, input: CourierSurchargeInput) {
  const fuel = baseFreight * (input.fuelPct / 100);
  const remote = input.remote ? input.remoteAmount : 0;
  const residential = input.residential ? input.residentialAmount : 0;
  const saturday = input.saturday ? input.saturdayAmount : 0;
  const dg = input.dg ? input.dgAmount : 0;
  const insurance = input.insurance
    ? Math.max((input.declaredValue * input.insurancePct) / 100, 25)
    : 0;
  const oversized = input.oversized ? input.oversizedAmount : 0;
  const total = fuel + remote + residential + saturday + dg + insurance + oversized;
  return { fuel, remote, residential, saturday, dg, insurance, oversized, total };
}

export function calculateCourierFreight(input: CourierFreightInput): CourierFreightResult {
  const { lines, chargeableKg, oversized } = summarizeCourierPackages(
    input.packages,
    input.dimUnit,
  );
  const zone = getCourierZone(input.originCountry, input.destCountry);
  const quotes = buildCarrierQuotes(
    chargeableKg,
    zone,
    input.service,
    input.currency,
    input.marginPct,
  );
  const chosen = quotes.find((q) => q.id === input.selectedCarrierId) || quotes[0];

  const baseFreight = chosen?.sellLocal ?? 0;
  const buyFreight = chosen?.buyLocal ?? 0;
  const surchargeCalc = calcSurcharges(baseFreight, input.surcharges);
  const subtotal = baseFreight + surchargeCalc.total;
  const tax = input.gstEnabled ? subtotal * 0.18 : 0;
  const total = subtotal + tax;
  const grossProfit =
    (chosen ? chosen.sellLocal - chosen.buyLocal : 0) +
    surchargeCalc.fuel * (input.marginPct / 100);

  return {
    packages: lines,
    chargeableKg,
    zone,
    oversized,
    quotes,
    chosen,
    baseFreight,
    buyFreight,
    surcharges: {
      fuel: surchargeCalc.fuel,
      fuelPct: input.surcharges.fuelPct,
      remote: surchargeCalc.remote,
      residential: surchargeCalc.residential,
      saturday: surchargeCalc.saturday,
      dg: surchargeCalc.dg,
      insurance: surchargeCalc.insurance,
      oversized: surchargeCalc.oversized,
      total: surchargeCalc.total,
      declaredValue: input.surcharges.declaredValue,
    },
    subtotal,
    tax,
    total,
    grossProfit,
  };
}
