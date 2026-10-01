import type { SalesLead } from "@/lib/types";
import { lossReasonLabel } from "@/lib/sales/loss-reasons";

export type Outcome = "won" | "lost";

/** Won ÷ (won + lost). null when nothing has closed yet — never a misleading 0%. */
export function winRate(leads: SalesLead[]): number | null {
  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  return won + lost === 0 ? null : won / (won + lost);
}

/** Mean deal value of closed leads with the given outcome; leads with no value are ignored. */
export function averageDealSize(leads: SalesLead[], outcome: Outcome = "won"): number | null {
  const valued = leads.filter((l) => l.status === outcome && (l.dealValue || 0) > 0);
  if (!valued.length) return null;
  return valued.reduce((s, l) => s + (l.dealValue || 0), 0) / valued.length;
}

export interface LossReasonRow {
  code: string;
  label: string;
  count: number;
  value: number;
}

export const UNSPECIFIED_REASON = "unspecified";

export function lossReasonBreakdown(leads: SalesLead[]): LossReasonRow[] {
  const map = new Map<string, LossReasonRow>();
  for (const lead of leads.filter((l) => l.status === "lost")) {
    const code = lead.lossReasonCode || UNSPECIFIED_REASON;
    const row = map.get(code) ?? {
      code,
      label: code === UNSPECIFIED_REASON ? "No reason recorded" : lossReasonLabel(code),
      count: 0,
      value: 0,
    };
    row.count += 1;
    row.value += lead.dealValue || 0;
    map.set(code, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.value - a.value);
}
