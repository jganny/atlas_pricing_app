"use client";

import { doc, setDoc } from "firebase/firestore";
import { nextQuoteNumber } from "@/lib/quotes/ref-id";
import { computeGp } from "@/lib/pricing/quote-display";
import { truckerSnapshot } from "@/lib/quotes/option-breakdown";
import { plainLaneLabel, type QuotedLaneRow, type QuoteLane } from "@/lib/quotes/lanes";
import { getFirebaseDb } from "./client";
import { omitUndefinedDeep } from "./sanitize";

export async function saveTransportQuote(input: {
  quoteId?: string;
  customer: string;
  creator: string;
  origin: string;
  destination: string;
  vehicleType: string;
  serviceType?: string;
  currency: string;
  freightBuy: number;
  freightSell: number;
  detention: number;
  tolls: number;
  truckerName?: string;
  truckers?: Array<{
    id: string;
    name: string;
    laneId?: string;
    selected: boolean;
    freightBuy: number;
    freightSell: number;
    detention: number;
    tolls: number;
  }>;
  lanes?: QuoteLane[];
  quotedLanes?: QuotedLaneRow[];
  allLanesAmount?: number;
  commodity?: string;
  ewayBillNo?: string;
  ewayRequired?: boolean;
  gstin?: string;
  invoiceValue?: number;
  validity?: string;
  notes?: string;
  terms?: string;
}): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const singleLaneTotal = input.freightSell + input.detention + input.tolls;
  const total = input.allLanesAmount && input.allLanesAmount > 0 ? input.allLanesAmount : singleLaneTotal;
  const buy = input.freightBuy;
  // GP compares the currently-focused trucker's own sell vs buy, never the
  // all-lanes aggregate against one lane's buy figure.
  const { gp, gpReady } = computeGp(singleLaneTotal, buy);
  const lanes = input.lanes?.length ? input.lanes : [{ id: "lane_0", origin: input.origin, destination: input.destination }];
  const route = lanes.length > 1
    ? lanes.map((l) => `${l.origin} → ${l.destination}`.trim()).filter((s) => s !== "→").join(" · ")
    : `${input.origin} → ${input.destination}`;
  const fallbackLaneId = lanes[0]?.id || "";
  const now = new Date();
  await setDoc(doc(getFirebaseDb(), "quotes", id), omitUndefinedDeep({
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
    ...(gpReady
      ? {
          grossProfit: gp,
          grossProfitCurrency: input.currency,
        }
      : {}),
    buyRate: buy,
    route,
    routingDetails: route,
    notes: input.notes || "",
    details: {
      mode: "Transport",
      type: "transport",
      module: "transport",
      vehicleType: input.vehicleType,
      serviceType: input.serviceType || "",
      freightBuy: input.freightBuy,
      freightSell: input.freightSell,
      detention: input.detention,
      tolls: input.tolls,
      commodity: input.commodity || "",
      ewayBillNo: input.ewayBillNo || "",
      ewayRequired: Boolean(input.ewayRequired),
      gstin: input.gstin || "",
      invoiceValue: input.invoiceValue ?? 0,
      validity: input.validity || "",
      truckerName: input.truckerName || "",
      truckers: (input.truckers ?? []).map((t) =>
        truckerSnapshot(t, input.validity || "", lanes, fallbackLaneId, plainLaneLabel),
      ),
      lanes: lanes.map((l) => ({ id: l.id, origin: l.origin, destination: l.destination })),
      quotedLanes: input.quotedLanes ?? [],
      allLanesTotal: input.allLanesAmount ?? 0,
      termsAndConditions: input.terms || "",
    },
  }));
  return id;
}

export async function saveWarehouseQuote(input: {
  quoteId?: string;
  customer: string;
  creator: string;
  location: string;
  otherDescription?: string;
  storageType: string;
  currency: string;
  ratePerCbm: number;
  cbm: number;
  handling: number;
  days: number;
  buyTotal?: number;
  validity?: string;
  notes?: string;
  terms?: string;
}): Promise<string> {
  const id = input.quoteId ?? `Q${Math.random().toString(36).slice(2, 11)}`;
  const storage = input.ratePerCbm * input.cbm * Math.max(1, input.days);
  const total = storage + input.handling;
  const buy = input.buyTotal ?? 0;
  const { gp, gpReady } = computeGp(total, buy);
  const routeLabel =
    input.location === "Others" && input.otherDescription?.trim()
      ? `Others — ${input.otherDescription.trim()}`
      : input.location;
  const now = new Date();
  await setDoc(doc(getFirebaseDb(), "quotes", id), omitUndefinedDeep({
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
    ...(gpReady
      ? {
          grossProfit: gp,
          grossProfitCurrency: input.currency,
        }
      : {}),
    buyRate: buy,
    route: routeLabel,
    routingDetails: routeLabel,
    notes: input.notes || "",
    details: {
      mode: "Warehouse",
      type: "warehouse",
      module: "warehouse",
      location: input.location,
      otherDescription: input.otherDescription || "",
      storageType: input.storageType,
      ratePerCbm: input.ratePerCbm,
      cbm: input.cbm,
      handling: input.handling,
      days: input.days,
      buyTotal: buy,
      storage,
      validity: input.validity || "",
      termsAndConditions: input.terms || "",
    },
  }));
  return id;
}
