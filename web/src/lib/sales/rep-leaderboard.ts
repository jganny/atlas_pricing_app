import type { SalesLead } from "@/lib/types";

export interface RepStats {
  owner: string;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
  revenue: number;
  avgDealSize: number | null;
}

export const UNASSIGNED = "unassigned";

/** Won-revenue leaderboard by lead owner (distinct from quoting volume per desk). */
export function repLeaderboard(leads: SalesLead[]): RepStats[] {
  const map = new Map<string, { won: number; lost: number; open: number; revenue: number }>();
  for (const lead of leads) {
    const owner = (lead.owner || "").trim().toLowerCase() || UNASSIGNED;
    const s = map.get(owner) ?? { won: 0, lost: 0, open: 0, revenue: 0 };
    if (lead.status === "won") {
      s.won += 1;
      s.revenue += lead.dealValue || 0;
    } else if (lead.status === "lost") s.lost += 1;
    else s.open += 1;
    map.set(owner, s);
  }
  return [...map.entries()]
    .map(([owner, s]) => ({
      owner,
      ...s,
      winRate: s.won + s.lost ? s.won / (s.won + s.lost) : null,
      avgDealSize: s.won ? s.revenue / s.won : null,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.won - a.won || a.owner.localeCompare(b.owner));
}
