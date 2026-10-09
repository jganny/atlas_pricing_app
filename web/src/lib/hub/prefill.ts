/**
 * A Quote Hub job → what a desk needs to fill itself. Air and Sea reuse the desks' existing
 * "smart quote" prefill; Courier, Transport and Warehouse get their own small hand-over.
 * Rates, carriers and liners are never part of it.
 */
import type { ParsedEnquiry } from "@/lib/types";
import { storeSmartQuotePrefill, type SmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import { placeLabel } from "./normalize";
import type { HubJob, HubMode } from "./types";

export function toParsedEnquiry(job: HubJob): ParsedEnquiry {
  const x = job.extraction;
  const notes = [x.notes, x.hsCode ? `HS ${x.hsCode}` : "", x.invoiceValue ? `Invoice value ${x.currency || ""} ${x.invoiceValue}`.trim() : ""]
    .filter(Boolean)
    .join(" · ");
  const parsed: ParsedEnquiry = {
    customer: job.customer,
    origin: placeLabel(x.origin),
    destination: placeLabel(x.destination),
    commodity: x.commodity || undefined,
    incoterm: x.incoterm || undefined,
    module: x.direction === "export" || x.direction === "import" ? x.direction : undefined,
    notes: notes || undefined,
    specialHandling: x.specialHandling.length ? x.specialHandling : undefined,
    grossWeight: x.grossWeightKg ?? undefined,
    volume: x.volumeCbm ?? undefined,
    packages: x.packages.map((p) => ({ qty: p.qty, gw: p.gw, l: p.l, w: p.w, h: p.h })),
    containers: x.containers,
    mode: x.seaMode ?? undefined,
    confidence: x.needsCheck.length ? 0.7 : 0.9,
    source: `Quote Hub · ${job.files[0] ?? "documents"}`,
  };
  return parsed;
}

export function toSmartPrefill(job: HubJob): SmartQuotePrefill {
  return {
    mode: job.mode === "sea" ? "sea" : "air",
    parsed: toParsedEnquiry(job),
    carrierLabel: "",
    tariffFound: false,
    currency: job.extraction.currency || undefined,
    createdAt: Date.now(),
  };
}

export interface HubDeskPrefill {
  mode: "courier" | "transport" | "warehouse";
  customer: string;
  origin: string;
  destination: string;
  originCountry: string;
  destCountry: string;
  packages: Array<{ qty: number; gw: number; l: number; w: number; h: number }>;
  commodity: string;
  invoiceValue: number;
  vehicleType: string;
  location: string;
  cbm: number;
  days: number;
  notes: string;
}

export function toDeskPrefill(job: HubJob): HubDeskPrefill {
  const x = job.extraction;
  return {
    mode: job.mode === "transport" || job.mode === "warehouse" ? job.mode : "courier",
    customer: job.customer,
    origin: x.origin.text || x.origin.code,
    destination: x.destination.text || x.destination.code,
    originCountry: x.origin.country,
    destCountry: x.destination.country,
    packages: x.packages.map((p) => ({ qty: p.qty, gw: p.gw ?? 0, l: p.l ?? 0, w: p.w ?? 0, h: p.h ?? 0 })),
    commodity: x.commodity,
    invoiceValue: x.invoiceValue ?? 0,
    vehicleType: x.vehicleType,
    location: x.storageLocation || x.destination.text,
    cbm: x.storageCbm ?? x.volumeCbm ?? 0,
    days: x.storageDays ?? 0,
    notes: x.notes,
  };
}

const KEY = (mode: string) => `atlas-hub-prefill-${mode}`;

export function storeHubPrefill(prefill: HubDeskPrefill) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY(prefill.mode), JSON.stringify(prefill));
}

export function peekHubPrefill(mode: HubDeskPrefill["mode"]): HubDeskPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY(mode));
    return raw ? (JSON.parse(raw) as HubDeskPrefill) : null;
  } catch {
    return null;
  }
}

export function clearHubPrefill(mode: HubDeskPrefill["mode"]) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY(mode));
}

export const HUB_DESK_PATH: Record<HubMode, string> = {
  air: "/air/",
  sea: "/sea/",
  courier: "/courier/",
  transport: "/transport/",
  warehouse: "/warehouse/",
};

/** Hands the job to its desk and returns where to go. */
export function openJobHref(job: HubJob): string {
  if (job.mode === "air" || job.mode === "sea") {
    storeSmartQuotePrefill(toSmartPrefill(job));
    return `${HUB_DESK_PATH[job.mode]}?smart=1`;
  }
  storeHubPrefill(toDeskPrefill(job));
  return `${HUB_DESK_PATH[job.mode]}?hub=1`;
}

/** "20 ft container", "32ft truck" → the closest vehicle type on the Transport desk, or null. */
export function matchVehicleType(types: readonly string[], text: string): string | null {
  const t = text.toLowerCase();
  if (!t.trim()) return null;
  const exact = types.find((v) => v.toLowerCase() === t);
  if (exact) return exact;
  const size = /(\d{2})\s*(?:ft|feet|foot|')/.exec(t)?.[1] ?? /(\d+(?:\.\d)?)\s*(?:ton|tonne|mt)/.exec(t)?.[1];
  if (!size) return null;
  const isTon = /ton|tonne|mt/.test(t) && !/ft|feet|foot/.test(t);
  return types.find((v) => (isTon ? new RegExp(`\\b${size}\\s*ton`, "i").test(v) : new RegExp(`\\b${size}\\s*ft`, "i").test(v))) ?? null;
}
