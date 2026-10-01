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

/** A lead can carry more than one mode now (`modes`); old leads only ever
 * had the single `mode` field. This is the one place that reconciles them —
 * everything else should read effectiveLeadModes(), never `lead.mode` directly. */
export function effectiveLeadModes(lead: Pick<SalesLead, "mode" | "modes">): NonNullable<SalesLead["modes"]> {
  if (lead.modes?.length) return lead.modes;
  return lead.mode ? [lead.mode] : [];
}

export function deskPathForLeadMode(mode?: SalesLead["mode"]): string {
  if (mode === "sea") return "/sea/";
  if (mode === "courier") return "/courier/";
  if (mode === "transport") return "/transport/";
  if (mode === "warehouse") return "/warehouse/";
  return "/air/";
}

/** For a multi-mode lead, "Create quote" needs one link per mode — a single
 * href can't say which desk the client meant. Single-mode (or legacy,
 * mode-less) leads still get exactly one link, same as before. */
export function deskHrefsForLead(lead: SalesLead): Array<{ mode: SalesLead["mode"]; href: string }> {
  const modes = effectiveLeadModes(lead);
  const list = modes.length ? modes : [undefined];
  const q = new URLSearchParams();
  if (lead.company) q.set("customer", lead.company);
  if (lead.lane) {
    const { origin, dest } = splitLane(lead.lane);
    if (origin) q.set("origin", origin);
    if (dest) q.set("dest", dest);
  }
  const qs = q.toString();
  return list.map((mode) => ({ mode, href: `${deskPathForLeadMode(mode)}${qs ? `?${qs}` : ""}` }));
}

/** Back-compat single-link helper — first effective mode only. */
export function deskHrefForLead(lead: SalesLead): string {
  return deskHrefsForLead(lead)[0]?.href ?? deskPathForLeadMode(undefined);
}

export function stashLeadDeskPrefill(lead: SalesLead, forMode?: SalesLead["mode"]) {
  const { origin, dest } = splitLane(lead.lane);
  const chosen = forMode ?? effectiveLeadModes(lead)[0];
  const mode = chosen === "sea" ? "sea" : "air";
  if (chosen === "air" || chosen === "sea" || !chosen) {
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
      leadId: lead.id,
    });
  }
}
