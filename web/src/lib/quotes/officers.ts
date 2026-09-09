import type { EnquiryRecord } from "@/lib/types";
import { TEAM_ROLES, deskDisplayName } from "@/lib/quotes/team-roles";

export interface OfficerOption {
  id: string;
  name: string;
  quoteCount: number;
}

/** Everyone on saved quotes plus known desks — not a hard-coded shortlist. */
export function listOfficersFromQuotes(rows: EnquiryRecord[]): OfficerOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const id = (r.creator || "").toLowerCase().trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  for (const id of Object.keys(TEAM_ROLES)) {
    if (!counts.has(id)) counts.set(id, 0);
  }
  return Array.from(counts.entries())
    .map(([id, quoteCount]) => ({
      id,
      name: deskDisplayName(id),
      quoteCount,
    }))
    .sort((a, b) => b.quoteCount - a.quoteCount || a.name.localeCompare(b.name));
}

export function officerLabel(o: OfficerOption): string {
  const base = o.name && o.name.toLowerCase() !== o.id ? `${o.name} (${o.id})` : o.id;
  return o.quoteCount > 0 ? `${base} · ${o.quoteCount}` : `${base} · none in view`;
}
