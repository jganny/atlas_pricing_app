"use client";

import { doc, setDoc } from "firebase/firestore";
import type { CourierFreightResult } from "@atlas/pricing-core";
import { getFirebaseDb } from "./client";

const DEFAULT_COURIER_TERMS =
  "1. Rates are based on chargeable weight (max of actual vs volumetric per piece).\n" +
  "2. Volumetric weight (cm): L × W × H ÷ 5000 × quantity per piece.\n" +
  "3. Fuel surcharge, remote area, residential, oversized and insurance are additional unless stated.\n" +
  "4. Transit times are estimates only — not guaranteed unless express service is confirmed in writing.\n" +
  "5. Customs duties, taxes and brokerage are receiver's account unless DDP is quoted.\n" +
  "6. Dangerous goods, lithium batteries and restricted commodities require prior approval.\n" +
  "7. Claims subject to carrier terms; insurance as declared value basis only.";

export interface SaveCourierInput {
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
}

export async function saveCourierQuote(input: SaveCourierInput): Promise<string> {
  const id = `Q${Math.random().toString(36).slice(2, 11)}`;
  const route = `${input.originCity || input.originCountry} → ${input.destCity || input.destCountry}`;
  const now = new Date();
  const quoteData = {
    id,
    date: now.toISOString().split("T")[0],
    timestamp: Date.now(),
    customer: input.customer,
    creator: input.creator,
    status: "quoted",
    quoteNumber: Math.floor(now.getTime() / 1000) % 100000,
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
      termsAndConditions: DEFAULT_COURIER_TERMS,
    },
    notes: `Courier quote. CHW: ${input.calc.chargeableKg} kg, Zone ${input.calc.zone}, ${input.calc.chosen?.name ?? ""}`,
  };

  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", id), quoteData);
  return id;
}
