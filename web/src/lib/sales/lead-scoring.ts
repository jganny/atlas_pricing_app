import type { SalesLead } from "@/lib/types";

export interface ScoreFactor {
  label: string;
  points: number;
}

export interface LeadScore {
  total: number;
  factors: ScoreFactor[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const STAGE_POINTS: Partial<Record<SalesLead["status"], number>> = {
  new: 0,
  contacted: 8,
  qualified: 16,
  quoted: 24,
};

const STRONG_SOURCES = ["referral", "existing customer", "tender", "rfq"];
const WARM_SOURCES = ["inbound email", "phone"];

/**
 * Transparent, additive 0-100 score for OPEN leads — every point is listed in
 * `factors`, nothing is hidden or learned. Recency uses `updatedAt` (not the
 * activity log) so the whole list can be scored without loading activities.
 * Closed leads are fixed: won = 100, lost = 0.
 */
export function computeLeadScore(lead: SalesLead, now: number = Date.now()): LeadScore {
  if (lead.status === "won") return { total: 100, factors: [{ label: "Closed won", points: 100 }] };
  if (lead.status === "lost") return { total: 0, factors: [{ label: "Closed lost", points: 0 }] };

  const factors: ScoreFactor[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) factors.push({ label, points });
  };

  let contact = 0;
  if (lead.email || lead.phone) contact += 10;
  if (lead.contactName) contact += 5;
  add("Contact details on file", contact);

  const value = lead.dealValue || 0;
  if (value >= 1_000_000) add("Deal value ≥ 10 lakh", 20);
  else if (value >= 250_000) add("Deal value ≥ 2.5 lakh", 14);
  else if (value >= 50_000) add("Deal value ≥ 50k", 8);
  else if (value > 0) add("Deal value entered", 3);

  add(`Stage: ${lead.status}`, STAGE_POINTS[lead.status] ?? 0);

  const updated = Date.parse(lead.updatedAt || "");
  if (Number.isFinite(updated)) {
    const ageDays = (now - updated) / DAY_MS;
    if (ageDays <= 7) add("Touched in the last 7 days", 15);
    else if (ageDays <= 30) add("Touched in the last 30 days", 8);
    else if (ageDays > 60) add("No activity for 60+ days", -10);
  }

  if (lead.nextDueDate) {
    const today = new Date(now).toISOString().slice(0, 10);
    if (lead.nextDueDate <= today) add("Follow-up overdue", -10);
    else add("Follow-up scheduled", 5);
  }

  if ((lead.quoteIds?.length ?? 0) > 0) add("Quote already sent", 10);

  const source = (lead.source || "").toLowerCase();
  if (STRONG_SOURCES.some((s) => source.includes(s))) add("High-intent source", 10);
  else if (WARM_SOURCES.some((s) => source.includes(s))) add("Direct inbound source", 5);

  if (lead.accountId) add("Linked to an account", 5);

  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  return { total: Math.min(100, Math.max(0, raw)), factors };
}

export function scoreTone(total: number): "success" | "warn" | "neutral" {
  return total >= 60 ? "success" : total >= 30 ? "warn" : "neutral";
}
