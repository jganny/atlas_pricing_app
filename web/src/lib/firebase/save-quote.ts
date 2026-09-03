"use client";

import { doc, setDoc } from "firebase/firestore";
import type { CourierFreightResult } from "@atlas/pricing-core";
import type { AirlineOption, LinerOption } from "@/lib/pricing/carrier-options";
import type { AirlineTotals } from "@/lib/pricing/air-desk";
import type { LinerTotals } from "@/lib/pricing/sea-desk";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import { getFirebaseDb } from "./client";

export const DEFAULT_COURIER_TERMS =
  "1. Rates are based on chargeable weight (max of actual vs volumetric per piece).\n" +
  "2. Volumetric weight (cm): L × W × H ÷ 5000 × quantity per piece.\n" +
  "3. Fuel surcharge, remote area, residential, oversized and insurance are additional unless stated.\n" +
  "4. Transit times are estimates only — not guaranteed unless express service is confirmed in writing.\n" +
  "5. Customs duties, taxes and brokerage are receiver's account unless DDP is quoted.\n" +
  "6. Dangerous goods, lithium batteries and restricted commodities require prior approval.\n" +
  "7. Claims subject to carrier terms; insurance as declared value basis only.";

interface SaveMeta {
  quoteId?: string;
  quoteNumber?: string | number;
  status?: string;
}

export interface SaveCourierInput extends SaveMeta {
  customer: string;
  creator: string;
  originCity: string;
  destCity: string;
  originCountry: string;
  destCountry: string;
  scope: string;
  service: string;
  currency: string;
  marginPct: number;
  gstEnabled: boolean;
  packages: CourierFreightResult["packages"];
  calc: CourierFreightResult;
  termsAndConditions?: string;
}

export async function saveCourierQuote(input: SaveCourierInput): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const route = `${input.originCity || input.originCountry} → ${input.destCity || input.destCountry}`;
  const now = new Date();
  const quoteData = {
    id,
    date: now.toISOString().split("T")[0],
    timestamp: Date.now(),
    customer: input.customer,
    creator: input.creator,
    status: input.status ?? "quoted",
    quoteNumber: input.quoteNumber ?? nextQuoteNumber(),
    mode: "Courier",
    type: "courier",
    amount: input.calc.total,
    currency: input.currency,
    amountINR: input.currency === "INR" ? input.calc.total : input.calc.total * 83,
    grossProfit: input.calc.grossProfit,
    grossProfitCurrency: input.currency,
    route,
    routingDetails: route,
    details: {
      mode: "Courier",
      type: "courier",
      module: "courier",
      routing: route,
      originCity: input.originCity,
      destCity: input.destCity,
      originCountry: input.originCountry,
      destCountry: input.destCountry,
      scope: input.scope,
      service: input.service,
      shipmentType: "parcel",
      chargeableWeight: input.calc.chargeableKg,
      zone: input.calc.zone,
      carrier: input.calc.chosen?.id ?? "",
      carrierName: input.calc.chosen?.name ?? "",
      transit: input.calc.chosen?.transit ?? "",
      packages: input.packages,
      carrierQuotes: input.calc.quotes,
      surcharges: input.calc.surcharges,
      baseFreight: input.calc.baseFreight,
      buyFreight: input.calc.buyFreight,
      subtotal: input.calc.subtotal,
      gstEnabled: input.gstEnabled,
      gstRate: input.gstEnabled ? 18 : 0,
      gstAmount: input.calc.tax,
      marginPct: input.marginPct,
      declaredValue: input.calc.surcharges.declaredValue,
      termsAndConditions: input.termsAndConditions ?? DEFAULT_COURIER_TERMS,
    },
    notes: `Courier quote. CHW: ${input.calc.chargeableKg} kg, Zone ${input.calc.zone}, ${input.calc.chosen?.name ?? ""}`,
  };

  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", id), quoteData);
  return id;
}

export interface SaveAirInput extends SaveMeta {
  customer: string;
  creator: string;
  origin: string;
  destination: string;
  currency: string;
  incoterm: string;
  commodity: string;
  module: "export" | "import";
  cargo: Array<{ l: number; w: number; h: number; qty: number; gw: number }>;
  selected: AirlineOption;
  totals: AirlineTotals;
  airlines: AirlineOption[];
  termsAndConditions: string;
  customExchangeRate?: number;
}

export async function saveAirQuote(input: SaveAirInput): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const originCode = input.origin.split(" - ")[0]?.trim() || input.origin.trim();
  const destCode = input.destination.split(" - ")[0]?.trim() || input.destination.trim();
  const airline = input.selected.name;
  const route = `${originCode} → ${destCode} via ${airline || "Any"}`;
  const now = new Date();
  const amount = input.totals.grandSell;
  const fx = input.customExchangeRate && input.customExchangeRate > 0 ? input.customExchangeRate : 83.5;
  const amountINR = input.currency === "INR" ? amount : amount * fx;
  const gp = input.totals.gp;

  const alternatives = input.airlines
    .filter((a) => a.id !== input.selected.id)
    .map((a) => ({
      name: a.name,
      routing: a.routing,
      tt: a.tt,
      validity: a.validity,
      breaks: a.breaks,
      originFeesEnabled: a.originFeesEnabled,
      destFeesEnabled: a.destFeesEnabled,
      originSurcharges: a.originSurcharges,
      destSurcharges: a.destSurcharges,
      amsFee: a.amsFee,
      amsFeeEnabled: a.amsFeeEnabled,
      selected: false,
    }));

  const quoteData = {
    id,
    date: now.toISOString().split("T")[0],
    timestamp: Date.now(),
    customer: input.customer,
    creator: input.creator,
    status: input.status ?? "quoted",
    quoteNumber: input.quoteNumber ?? nextQuoteNumber(),
    type: "air",
    route,
    amount,
    amountINR,
    currency: input.currency,
    grossProfit: gp,
    grossProfitCurrency: input.currency,
    grossProfitINR: input.currency === "INR" ? gp : gp * fx,
    details: {
      origin: input.origin,
      destination: input.destination,
      airline,
      incoterm: input.incoterm,
      module: input.module,
      commodity: input.commodity,
      chargeableWeight: input.totals.freight.chargeableWeightKg,
      grossWeight: input.totals.freight.cargo.grossWeightKg,
      volumeWeight: input.totals.freight.cargo.volumeWeightKg,
      cbm: input.totals.freight.cargo.volumeCbm,
      quantity: input.totals.freight.cargo.packageQty,
      appliedRate: input.totals.freight.activeRate,
      appliedBuyRate: input.totals.freight.activeBuyRate,
      baseFreight: input.totals.freight.baseFreightSell,
      baseBuyFreight: input.totals.freight.baseFreightBuy,
      usedBreak: input.totals.freight.usedBreak,
      usingBuyFallback: input.totals.freight.usingBuyFallback,
      tariffsEnabled: input.selected.wbEnabled,
      originFeesEnabled: input.selected.originFeesEnabled,
      destFeesEnabled: input.selected.destFeesEnabled,
      originSurcharges: input.totals.origin,
      destSurcharges: input.totals.dest,
      surchargeTotal: input.totals.originTotal + input.totals.destTotal + input.totals.ams,
      amsFee: input.totals.ams,
      routing: input.selected.routing,
      tt: input.selected.tt,
      validity: input.selected.validity,
      pivotWeight: input.selected.pivotWeightKg,
      cargoItems: input.cargo,
      breaks: input.selected.breaks,
      airlines: input.airlines,
      alternatives,
      termsAndConditions: input.termsAndConditions,
      customExchangeRate: input.customExchangeRate ?? null,
      type: "air",
      mode: "Air",
    },
    notes: `Air quote (React Phase 7). CHW: ${input.totals.freight.chargeableWeightKg} kg · ${input.totals.freight.usedBreak} · ${input.airlines.length} options`,
  };

  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", id), quoteData);
  return id;
}

export interface SaveSeaInput extends SaveMeta {
  customer: string;
  creator: string;
  origin: string;
  destination: string;
  currency: string;
  incoterm: string;
  module: "export" | "import";
  mode: string;
  grossWeightKg: number;
  volumeCbm: number;
  selected: LinerOption;
  totals: LinerTotals;
  liners: LinerOption[];
  termsAndConditions: string;
  customExchangeRate?: number;
}

export async function saveSeaQuote(input: SaveSeaInput): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const originCode = input.origin.split(" - ")[0]?.trim() || input.origin.trim();
  const destCode = input.destination.split(" - ")[0]?.trim() || input.destination.trim();
  const liner = input.selected.name;
  const route = `${originCode} → ${destCode} via ${liner || "Any"}`;
  const now = new Date();
  const amount = input.totals.grandSell;
  const fx = input.customExchangeRate && input.customExchangeRate > 0 ? input.customExchangeRate : 83.5;
  const amountINR = input.currency === "INR" ? amount : amount * fx;
  const gp = input.totals.gp;

  const alternatives = input.liners
    .filter((l) => l.id !== input.selected.id)
    .map((l) => ({
      name: l.name,
      routing: l.routing,
      tt: l.tt,
      validity: l.validity,
      containers: l.containers,
      lclSell: l.lclSell,
      lclBuy: l.lclBuy,
      originFeesEnabled: l.originFeesEnabled,
      destFeesEnabled: l.destFeesEnabled,
      originSurcharges: l.originSurcharges,
      destSurcharges: l.destSurcharges,
      selected: false,
    }));

  const quoteData = {
    id,
    date: now.toISOString().split("T")[0],
    timestamp: Date.now(),
    customer: input.customer,
    creator: input.creator,
    status: input.status ?? "quoted",
    quoteNumber: input.quoteNumber ?? nextQuoteNumber(),
    type: "sea",
    route,
    amount,
    amountINR,
    currency: input.currency,
    grossProfit: gp,
    grossProfitCurrency: input.currency,
    grossProfitINR: input.currency === "INR" ? gp : gp * fx,
    details: {
      origin: input.origin,
      destination: input.destination,
      module: input.module,
      type: input.mode,
      shippingMode: input.mode,
      incoterm: input.incoterm,
      liner,
      routing: input.selected.routing,
      tt: input.selected.tt,
      validity: input.selected.validity,
      grossWeight: input.grossWeightKg,
      volume: input.volumeCbm,
      volumeCbm: input.volumeCbm,
      chargeableRt: input.totals.freight.chargeableRt,
      baseFreight: input.totals.freight.baseFreightSell,
      baseBuyFreight: input.totals.freight.baseFreightBuy,
      containerSummary: input.totals.freight.containerSummary,
      containers: input.selected.containers,
      usingBuyFallback: input.totals.freight.usingBuyFallback,
      tariffsEnabled: true,
      originFeesEnabled: input.selected.originFeesEnabled,
      destFeesEnabled: input.selected.destFeesEnabled,
      originSurcharges: input.totals.origin,
      destSurcharges: input.totals.dest,
      surchargeTotal: input.totals.originTotal + input.totals.destTotal,
      liners: input.liners,
      alternatives,
      termsAndConditions: input.termsAndConditions,
      customExchangeRate: input.customExchangeRate ?? null,
    },
    notes: `Sea quote (React Phase 7). ${input.mode.toUpperCase()} · RT ${input.totals.freight.chargeableRt} · ${input.liners.length} options`,
  };

  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", id), quoteData);
  return id;
}
