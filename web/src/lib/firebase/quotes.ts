"use client";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Query,
} from "firebase/firestore";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { allLanesRoute } from "@/lib/quotes/lanes";
import { deskDisplayName } from "@/lib/quotes/team-roles";
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

function num(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function billingMeta(data: SavedQuote): Pick<EnquiryRecord, "billingWeight" | "billingUnit"> {
  const d = data.details || {};
  const type = (data.type || "").toLowerCase();
  if (type.includes("air")) {
    const cw = num(d.chargeableWeight) || 0;
    const pw = num(d.pivotWeight) || 0;
    const gw = num(d.grossWeight) || 0;
    return { billingWeight: Math.max(cw, pw, gw) || undefined, billingUnit: "kg" };
  }
  if (type.includes("sea")) {
    const rt = num(d.lclChargeable) || num(d.chargeableCbm) || 0;
    if (rt > 0) return { billingWeight: rt, billingUnit: "rt" };
    const gw = num(d.grossWeight) || 0;
    return { billingWeight: gw || undefined, billingUnit: gw ? "gw" : undefined };
  }
  const gw = num(d.grossWeight) || 0;
  return { billingWeight: gw || undefined, billingUnit: gw ? "gw" : undefined };
}

function rec(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function laneOriginDest(data: SavedQuote): { origin: string; destination: string } {
  const d = data.details || {};
  const lanes = Array.isArray(d.lanes) ? d.lanes : [];
  if (lanes.length > 1) {
    const mapped = lanes.map((raw) => ({
      id: String(rec(raw).id ?? ""),
      origin: String(rec(raw).origin ?? ""),
      destination: String(rec(raw).destination ?? ""),
    }));
    return { origin: allLanesRoute(mapped), destination: "" };
  }
  return {
    origin:
      (d.origin as string) ||
      (data.route?.includes("→") ? data.route.split("→")[0]?.trim() : data.route) ||
      "",
    destination:
      (d.destination as string) ||
      (data.route?.includes("→") ? data.route.split("→").slice(1).join("→").trim() : "") ||
      "",
  };
}

function carrierLabel(data: SavedQuote): string {
  const d = data.details || {};
  const quoted = Array.isArray(d.quotedLanes) ? d.quotedLanes : [];
  if (quoted.length > 1) {
    return quoted
      .map((raw) => {
        const row = rec(raw);
        const label = String(row.laneLabel ?? "");
        const name = String(row.airline ?? row.name ?? "");
        return label && name ? `${label}: ${name}` : name;
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(d.airline ?? d.shippingLine ?? d.carrierName ?? d.carrier ?? "").trim();
}

export function mapQuoteFromSaved(id: string, data: SavedQuote): EnquiryRecord {
  const createdAt = data.date || String(data.timestamp ?? "");
  const open = isOpenQuoteStatus(data.status);
  const { origin, destination } = laneOriginDest(data);

  const amount = num(data.amount);
  const gp = num(data.grossProfit);
  const buyFromGp =
    amount != null && gp != null ? amount - gp : undefined;
  const buyRate = num(data.buyRate) ?? num(data.details?.buyRate);
  const confirmedBuyRate = num(data.confirmedBuyRate);
  const carrier = carrierLabel(data);

  return {
    id,
    ref: getQuoteRefId(data),
    customer: data.customer || "—",
    mode: mapMode(data.type, data.details?.module as string),
    origin,
    destination,
    status: mapStatus(data.status),
    slaHoursOpen: open ? Math.round(hoursSince(createdAt)) : 0,
    assignee: deskDisplayName(data.creator || ""),
    creator: (data.creator || "").toLowerCase(),
    createdAt,
    grandTotal: amount,
    currency: data.currency,
    amountINR: num(data.amountINR),
    grossProfit: gp,
    grossProfitCurrency: data.grossProfitCurrency,
    buyTotal: buyFromGp ?? buyRate ?? confirmedBuyRate,
    buyRate,
    confirmedBuyRate,
    carrier: carrier || undefined,
    appliedRate: num(data.details?.appliedRate),
    appliedBuyRate: num(data.details?.appliedBuyRate),
    usedBreak: data.details?.usedBreak ? String(data.details.usedBreak) : undefined,
    ...billingMeta(data),
  };
}

/** @deprecated use mapQuoteFromSaved */
function mapQuote(id: string, data: SavedQuote): EnquiryRecord {
  return mapQuoteFromSaved(id, data);
}

function enquiriesQuery(max: number): Query {
  const db = getFirebaseDb();
  return query(collection(db, "quotes"), orderBy("timestamp", "desc"), limit(max));
}

export async function fetchLiveEnquiries(max = 400): Promise<EnquiryRecord[]> {
  const snap = await getDocs(enquiriesQuery(max));
  return snap.docs.map((docSnap) => mapQuote(docSnap.id, docSnap.data() as SavedQuote));
}

/** Real-time subscription — live enquiry list without manual refresh. */
export function subscribeLiveEnquiries(
  onData: (rows: EnquiryRecord[]) => void,
  onError?: (err: Error) => void,
  max = 400,
): () => void {
  return onSnapshot(
    enquiriesQuery(max),
    (snap) => {
      const rows = snap.docs.map((docSnap) => mapQuote(docSnap.id, docSnap.data() as SavedQuote));
      onData(rows);
    },
    (err) => onError?.(err),
  );
}
