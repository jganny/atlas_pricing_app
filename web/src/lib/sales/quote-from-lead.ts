import type { EnquiryRecord, SalesLead } from "@/lib/types";
import { storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";

export const LEAD_SOURCES = [
  "Inbound email",
  "Phone",
  "Referral",
  "Existing customer",
  "Tender / RFQ",
  "Web / LinkedIn",
  "Walk-in",
] as const;

export function splitLane(lane?: string): { origin: string; dest: string } {
  const raw = (lane || "").trim();
  if (!raw) return { origin: "", dest: "" };
  const parts = raw.split(/\s*(?:→|->|—|-)\s*/);
  if (parts.length >= 2) return { origin: parts[0]!.trim(), dest: parts.slice(1).join(" → ").trim() };
  return { origin: raw, dest: "" };
}

export function isFollowUpDue(lead: SalesLead, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!lead.nextDueDate) return false;
  if (lead.status === "won" || lead.status === "lost") return false;
  return lead.nextDueDate <= today;
}

export function quotesForCompany(quotes: EnquiryRecord[], company?: string): EnquiryRecord[] {
  const c = (company || "").trim().toLowerCase();
  if (!c) return [];
  return quotes.filter((q) => (q.customer || "").toLowerCase().includes(c)).slice(0, 8);
}

export function deskPathForLeadMode(mode?: SalesLead["mode"]): string {
  if (mode === "sea") return "/sea/";
  if (mode === "courier") return "/courier/";
  if (mode === "transport") return "/transport/";
  if (mode === "warehouse") return "/warehouse/";
  return "/air/";
}

export function deskHrefForLead(lead: SalesLead): string {
  const { origin, dest } = splitLane(lead.lane);
  const q = new URLSearchParams();
  if (lead.company) q.set("customer", lead.company);
  if (origin) q.set("origin", origin);
  if (dest) q.set("dest", dest);
  const qs = q.toString();
  return `${deskPathForLeadMode(lead.mode)}${qs ? `?${qs}` : ""}`;
}

export function stashLeadDeskPrefill(lead: SalesLead) {
  const { origin, dest } = splitLane(lead.lane);
  const mode = lead.mode === "sea" ? "sea" : "air";
  if (lead.mode === "air" || lead.mode === "sea" || !lead.mode) {
    storeSmartQuotePrefill({
      mode,
      parsed: {
        customer: lead.company,
        origin,
        destination: dest,
        packages: [],
        containers: [],
        confidence: 0.6,
        source: "sales-lead",
      },
      carrierLabel: "",
      tariffFound: false,
      createdAt: Date.now(),
    });
  }
}
