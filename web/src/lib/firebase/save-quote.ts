"use client";

import { doc, setDoc } from "firebase/firestore";
import type { CourierFreightResult } from "@atlas/pricing-core";
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
  airline: string;
  routing: string;
  tt: string;
  validity: string;
  cargo: Array<{ l: number; w: number; h: number; qty: number; gw: number }>;
  calc: ReturnType<typeof import("@atlas/pricing-core").calculateAirFreight>;
  breaks: Record<string, { sell: number; buy: number }>;
}

export async function saveAirQuote(input: SaveAirInput): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const originCode = input.origin.split(" - ")[0]?.trim() || input.origin.trim();
  const destCode = input.destination.split(" - ")[0]?.trim() || input.destination.trim();
  const route = `${originCode} → ${destCode} via ${input.airline || "Any"}`;
  const now = new Date();
  const amount = input.calc.baseFreightSell;
  const amountINR = input.currency === "INR" ? amount : amount * 83;
  const gp = input.calc.baseFreightSell - input.calc.baseFreightBuy;

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
    grossProfitINR: input.currency === "INR" ? gp : gp * 83,
    details: {
      origin: input.origin,
      destination: input.destination,
      airline: input.airline,
      incoterm: input.incoterm,
      module: "export",
      commodity: input.commodity,
      chargeableWeight: input.calc.chargeableWeightKg,
      grossWeight: input.calc.cargo.grossWeightKg,
      volumeWeight: input.calc.cargo.volumeWeightKg,
      cbm: input.calc.cargo.volumeCbm,
      quantity: input.calc.cargo.packageQty,
      appliedRate: input.calc.activeRate,
      appliedBuyRate: input.calc.activeBuyRate,
      baseFreight: input.calc.baseFreightSell,
      baseBuyFreight: input.calc.baseFreightBuy,
      usedBreak: input.calc.usedBreak,
      usingBuyFallback: input.calc.usingBuyFallback,
      tariffsEnabled: true,
      originFeesEnabled: false,
      destFeesEnabled: false,
      routing: input.routing,
      tt: input.tt,
      validity: input.validity,
      cargoItems: input.cargo,
      breaks: input.breaks,
      type: "air",
      mode: "Air",
    },
    notes: `Air quote (React). CHW: ${input.calc.chargeableWeightKg} kg · ${input.calc.usedBreak}`,
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
  liner: string;
  routing: string;
  tt: string;
  validity: string;
  mode: string;
  grossWeightKg: number;
  volumeCbm: number;
  containers: Array<{ type: string; qty: number; sellRate: number; buyRate: number }>;
  calc: ReturnType<typeof import("@atlas/pricing-core").calculateSeaFreight>;
}

export async function saveSeaQuote(input: SaveSeaInput): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const originCode = input.origin.split(" - ")[0]?.trim() || input.origin.trim();
  const destCode = input.destination.split(" - ")[0]?.trim() || input.destination.trim();
  const route = `${originCode} → ${destCode} via ${input.liner || "Any"}`;
  const now = new Date();
  const amount = input.calc.baseFreightSell;
  const amountINR = input.currency === "INR" ? amount : amount * 83;
  const gp = input.calc.baseFreightSell - input.calc.baseFreightBuy;

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
    grossProfitINR: input.currency === "INR" ? gp : gp * 83,
    details: {
      origin: input.origin,
      destination: input.destination,
      module: input.mode,
      type: input.mode,
      incoterm: input.incoterm,
      liner: input.liner,
      routing: input.routing,
      tt: input.tt,
      validity: input.validity,
      grossWeight: input.grossWeightKg,
      volume: input.volumeCbm,
      volumeCbm: input.volumeCbm,
      chargeableRt: input.calc.chargeableRt,
      baseFreight: input.calc.baseFreightSell,
      baseBuyFreight: input.calc.baseFreightBuy,
      containerSummary: input.calc.containerSummary,
      containers: input.containers,
      usingBuyFallback: input.calc.usingBuyFallback,
      tariffsEnabled: true,
    },
    notes: `Sea quote (React). ${input.mode.toUpperCase()} · RT ${input.calc.chargeableRt}`,
  };

  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", id), quoteData);
  return id;
}
