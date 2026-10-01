import type { SalesLead } from "@/lib/types";
import type { Outcome } from "@/lib/sales/win-loss";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from creation to close. null for open leads or when either timestamp is missing/unusable. */
export function cycleTimeDays(lead: SalesLead): number | null {
  const closed = lead.status === "won" ? lead.wonAt : lead.status === "lost" ? lead.lostAt : undefined;
  if (!closed || !lead.createdAt) return null;
  const start = Date.parse(lead.createdAt);
  const end = Date.parse(closed);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / DAY_MS;
}

export function averageCycleTimeDays(leads: SalesLead[], outcome?: Outcome): number | null {
  const days = leads
    .filter((l) => !outcome || l.status === outcome)
    .map(cycleTimeDays)
    .filter((d): d is number => d != null);
  return days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
}
