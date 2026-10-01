import type { SalesLead, SalesTarget, SalesTerritory } from "@/lib/types";

/** Periods are CALENDAR quarters ("2026-Q3" = Jul–Sep 2026). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function currentPeriod(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function parsePeriod(period: string): { year: number; q: number } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(period.trim());
  return m ? { year: Number(m[1]), q: Number(m[2]) } : null;
}

/** [start, end) in local time. */
export function periodRange(period: string): { start: number; end: number } | null {
  const p = parsePeriod(period);
  if (!p) return null;
  return {
    start: new Date(p.year, (p.q - 1) * 3, 1).getTime(),
    end: new Date(p.year, p.q * 3, 1).getTime(),
  };
}

export function periodLabel(period: string): string {
  const p = parsePeriod(period);
  if (!p) return period;
  const first = (p.q - 1) * 3;
  return `${MONTHS[first]} – ${MONTHS[first + 2]} ${p.year} (Q${p.q})`;
}

export function shiftPeriod(period: string, delta: number): string {
  const p = parsePeriod(period);
  if (!p) return period;
  const idx = p.year * 4 + (p.q - 1) + delta;
  return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
}

export function periodOptions(now: number = Date.now(), back = 1, forward = 3): string[] {
  const cur = currentPeriod(now);
  const out: string[] = [];
  for (let i = -back; i <= forward; i++) out.push(shiftPeriod(cur, i));
  return out;
}

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/**
 * Whose deals count toward a target: a rep username, "team:all" (everyone), or
 * "team:<territory name>" (leads tagged with that territory or owned by one of
 * its members).
 */
export function targetOwnerMatches(
  targetOwner: string,
  lead: Pick<SalesLead, "owner" | "territory">,
  territories: SalesTerritory[] = [],
): boolean {
  const t = norm(targetOwner);
  if (t === "team:all") return true;
  if (t.startsWith("team:")) {
    const name = t.slice(5);
    const terr = territories.find((x) => norm(x.name) === name);
    if (norm(lead.territory) === name) return true;
    return Boolean(terr?.ownerUsernames?.some((u) => norm(u) === norm(lead.owner)) && norm(lead.owner));
  }
  return norm(lead.owner) === t;
}

/** Close time of a won lead; leads closed before wonAt was stamped fall back to last update. */
export function wonTime(lead: SalesLead): number | null {
  const t = Date.parse(lead.wonAt || "") || Date.parse(lead.updatedAt || "");
  return Number.isFinite(t) ? t : null;
}

export interface QuotaProgress {
  achieved: number;
  wins: number;
  /** achieved ÷ targetRevenue, null when the target has no revenue goal. */
  revenuePct: number | null;
  /** wins ÷ targetWinCount, null when there is no win-count goal. */
  winsPct: number | null;
}

export function quotaProgress(
  target: SalesTarget,
  leads: SalesLead[],
  territories: SalesTerritory[] = [],
): QuotaProgress {
  const range = periodRange(target.period);
  let achieved = 0;
  let wins = 0;
  if (range) {
    for (const lead of leads) {
      if (lead.status !== "won" || !targetOwnerMatches(target.owner, lead, territories)) continue;
      const t = wonTime(lead);
      if (t == null || t < range.start || t >= range.end) continue;
      achieved += lead.dealValue || 0;
      wins += 1;
    }
  }
  return {
    achieved,
    wins,
    revenuePct: target.targetRevenue > 0 ? achieved / target.targetRevenue : null,
    winsPct: (target.targetWinCount || 0) > 0 ? wins / (target.targetWinCount as number) : null,
  };
}
