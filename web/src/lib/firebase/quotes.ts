"use client";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { EnquiryRecord } from "@/lib/types";
import { hoursSince, isOpenQuoteStatus } from "@/lib/sla";
import { getFirebaseDb } from "./client";

type QuoteDoc = {
  id?: string;
  quoteNumber?: string;
  customer?: string;
  type?: string;
  status?: string;
  date?: string;
  timestamp?: string;
  creator?: string;
  amount?: number;
  currency?: string;
  route?: string;
  details?: {
    origin?: string;
    destination?: string;
    module?: string;
  };
};

function mapMode(type: string | undefined, module: string | undefined): EnquiryRecord["mode"] {
  const value = (type || module || "air").toLowerCase();
  if (value.includes("sea")) return "sea";
  if (value.includes("courier")) return "courier";
  if (value.includes("transport")) return "transport";
  if (value.includes("warehouse")) return "warehouse";
  return "air";
}

function mapStatus(status: string | undefined): EnquiryRecord["status"] {
  const s = (status || "quoted").toLowerCase();
  if (s === "converted") return "won";
  if (s === "lost" || s === "cancelled") return "lost";
  if (s === "quoted") return "quoted";
  return "open";
}

function mapQuote(id: string, data: QuoteDoc): EnquiryRecord {
  const createdAt = data.date || data.timestamp || "";
  const open = isOpenQuoteStatus(data.status);
  const origin =
    data.details?.origin ||
    (data.route?.includes("-") ? data.route.split("-")[0]?.trim() : data.route) ||
    "";
  const destination =
    data.details?.destination ||
    (data.route?.includes("-") ? data.route.split("-").slice(1).join("-").trim() : "") ||
    "";

  return {
    id,
    ref: data.quoteNumber || data.id || id,
    customer: data.customer || "—",
    mode: mapMode(data.type, data.details?.module),
    origin,
    destination,
    status: mapStatus(data.status),
    slaHoursOpen: open ? Math.round(hoursSince(createdAt)) : 0,
    assignee: data.creator || "—",
    createdAt,
    grandTotal: data.amount,
    currency: data.currency,
  };
}

export async function fetchLiveEnquiries(max = 200): Promise<EnquiryRecord[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, "quotes"), orderBy("timestamp", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => mapQuote(docSnap.id, docSnap.data() as QuoteDoc));
}
