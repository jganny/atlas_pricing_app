import type { WeightBreaks } from "@atlas/pricing-core";
import type { SavedQuote } from "@/lib/types";
import type { AirCargoRow } from "@/lib/pricing/air-desk";
import type { SeaContainerRow } from "@/lib/pricing/sea-desk";

export function deskPathForQuote(quote: SavedQuote): string | null {
  const type = (quote.type || "").toLowerCase();
  if (type === "air") return "/air";
  if (type === "sea") return "/sea";
  if (type === "courier") return "/courier";
  return null;
}

export function loadAirDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};
  const cargoItems = (d.cargoItems as AirCargoRow[]) ?? [];
  return {
    customer: quote.customer ?? "",
    origin: String(d.origin ?? ""),
    destination: String(d.destination ?? ""),
    currency: quote.currency ?? "USD",
    incoterm: String(d.incoterm ?? "FOB"),
    commodity: String(d.commodity ?? "GENERAL"),
    airline: String(d.airline ?? ""),
    routing: String(d.routing ?? ""),
    tt: String(d.tt ?? ""),
    validity: String(d.validity ?? ""),
    pivotWeightKg: Number(d.pivotWeight ?? 0),
    cargo: cargoItems.length
      ? cargoItems
      : [{ l: 120, w: 80, h: 90, qty: 1, gw: 150 }],
    breaks: (d.breaks as WeightBreaks) ?? {},
  };
}

export function loadSeaDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};
  const containers = (d.containers as SeaContainerRow[]) ?? [];
  const mode = (d.type as "fcl" | "lcl" | "bb") || (d.module as "fcl" | "lcl" | "bb") || "fcl";
  return {
    customer: quote.customer ?? "",
    origin: String(d.origin ?? ""),
    destination: String(d.destination ?? ""),
    currency: quote.currency ?? "USD",
    incoterm: String(d.incoterm ?? "FOB"),
    liner: String(d.liner ?? d.shippingLine ?? ""),
    routing: String(d.routing ?? ""),
    tt: String(d.tt ?? ""),
    validity: String(d.validity ?? ""),
    mode,
    grossWeightKg: Number(d.grossWeight ?? 8500),
    volumeCbm: Number(d.volumeCbm ?? d.volume ?? 28),
    chargeableCbmOverride: 0,
    containers: containers.length
      ? containers
      : [{ type: "20'GP", qty: 1, sellRate: 800, buyRate: 700 }],
    lclSell: Number((d.lclRate as { sell?: number })?.sell ?? 45),
    lclBuy: Number((d.lclRate as { buy?: number })?.buy ?? 40),
  };
}

export function loadCourierDeskFromQuote(quote: SavedQuote) {
  const d = quote.details ?? {};
  const surcharges = (d.surcharges as Record<string, unknown>) ?? {};
  return {
    customer: quote.customer ?? "",
    originCity: String(d.originCity ?? ""),
    destCity: String(d.destCity ?? ""),
    originCountry: String(d.originCountry ?? "IN"),
    destCountry: String(d.destCountry ?? "IN"),
    scope: (d.scope as "domestic" | "international") ?? "domestic",
    service: String(d.service ?? "economy"),
    currency: quote.currency ?? "INR",
    marginPct: Number(d.marginPct ?? 12),
    selectedCarrier: String(d.carrier ?? "dhl"),
    gstEnabled: d.gstEnabled !== false,
    packages: (d.packages as Array<{ qty: number; gw?: number; l?: number; w?: number; h?: number }>) ?? [
      { qty: 1, gw: 5, l: 30, w: 20, h: 15 },
    ],
    surcharges: {
      fuelPct: Number(surcharges.fuelPct ?? 18),
      remote: Boolean(surcharges.remote),
      remoteAmount: Number(surcharges.remoteAmount ?? surcharges.remote ?? 450),
      residential: Boolean(surcharges.residential),
      residentialAmount: Number(surcharges.residentialAmount ?? surcharges.residential ?? 350),
      saturday: Boolean(surcharges.saturday),
      saturdayAmount: Number(surcharges.saturdayAmount ?? surcharges.saturday ?? 500),
      dg: Boolean(surcharges.dg),
      dgAmount: Number(surcharges.dgAmount ?? surcharges.dg ?? 1200),
      insurance: Boolean(surcharges.insurance),
      insurancePct: Number(surcharges.insurancePct ?? 1.5),
      declaredValue: Number(surcharges.declaredValue ?? 0),
      oversized: Boolean(surcharges.oversized),
      oversizedAmount: Number(surcharges.oversized ?? 800),
    },
    terms: String(d.termsAndConditions ?? ""),
  };
}
