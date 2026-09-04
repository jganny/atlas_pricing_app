"use client";

import { doc, setDoc } from "firebase/firestore";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import { getFirebaseDb } from "./client";

export async function saveTransportQuote(input: {
  quoteId?: string;
  customer: string;
  creator: string;
  origin: string;
  destination: string;
  vehicleType: string;
  currency: string;
  freightBuy: number;
  freightSell: number;
  detention: number;
  tolls: number;
  notes?: string;
  terms?: string;
}): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const total = input.freightSell + input.detention + input.tolls;
  const buy = input.freightBuy;
  const gp = total - buy;
  const route = `${input.origin} → ${input.destination}`;
  const now = new Date();
  await setDoc(doc(getFirebaseDb(), "quotes", id), {
    id,
    date: now.toISOString().split("T")[0],
    timestamp: Date.now(),
    customer: input.customer,
    creator: input.creator,
    status: "quoted",
    quoteNumber: nextQuoteNumber(),
    mode: "Transport",
    type: "transport",
    amount: total,
    currency: input.currency,
    amountINR: input.currency === "INR" ? total : total * 83,
    grossProfit: gp,
    grossProfitCurrency: input.currency,
    buyRate: buy,
    route,
    routingDetails: route,
    notes: input.notes || "",
    details: {
      mode: "Transport",
      type: "transport",
      module: "transport",
      vehicleType: input.vehicleType,
      freightBuy: input.freightBuy,
      freightSell: input.freightSell,
      detention: input.detention,
      tolls: input.tolls,
      termsAndConditions: input.terms || "",
    },
  });
  return id;
}

export async function saveWarehouseQuote(input: {
  quoteId?: string;
  customer: string;
  creator: string;
  location: string;
  storageType: string;
  currency: string;
  ratePerCbm: number;
  cbm: number;
  handling: number;
  days: number;
  notes?: string;
  terms?: string;
}): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const storage = input.ratePerCbm * input.cbm * Math.max(1, input.days);
  const total = storage + input.handling;
  const buy = total * 0.85;
  const gp = total - buy;
  const now = new Date();
  await setDoc(doc(getFirebaseDb(), "quotes", id), {
    id,
    date: now.toISOString().split("T")[0],
    timestamp: Date.now(),
    customer: input.customer,
    creator: input.creator,
    status: "quoted",
    quoteNumber: nextQuoteNumber(),
    mode: "Warehouse",
    type: "warehouse",
    amount: total,
    currency: input.currency,
    amountINR: input.currency === "INR" ? total : total * 83,
    grossProfit: gp,
    grossProfitCurrency: input.currency,
    buyRate: buy,
    route: input.location,
    routingDetails: input.location,
    notes: input.notes || "",
    details: {
      mode: "Warehouse",
      type: "warehouse",
      module: "warehouse",
      storageType: input.storageType,
      ratePerCbm: input.ratePerCbm,
      cbm: input.cbm,
      handling: input.handling,
      days: input.days,
      termsAndConditions: input.terms || "",
    },
  });
  return id;
}
