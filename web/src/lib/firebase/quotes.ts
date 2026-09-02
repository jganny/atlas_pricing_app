"use client";

import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { hoursSince, isOpenQuoteStatus } from "@/lib/sla";
import { getFirebaseDb } from "./client";

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
  if (s === "cancelled") return "cancelled";
  if (s === "lost") return "lost";
  if (s === "quoted") return "quoted";
  return "open";
}

function mapQuote(id: string, data: SavedQuote): EnquiryRecord {
  const createdAt = data.date || String(data.timestamp ?? "");
  const open = isOpenQuoteStatus(data.status);
  const origin =
    (data.details?.origin as string) ||
    (data.route?.includes("→") ? data.route.split("→")[0]?.trim() : data.route) ||
    "";
  const destination =
    (data.details?.destination as string) ||
    (data.route?.includes("→") ? data.route.split("→").slice(1).join("→").trim() : "") ||
    "";

  return {
    id,
    ref: getQuoteRefId(data),
    customer: data.customer || "—",
    mode: mapMode(data.type, data.details?.module as string),
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
  return snap.docs.map((docSnap) => mapQuote(docSnap.id, docSnap.data() as SavedQuote));
}
