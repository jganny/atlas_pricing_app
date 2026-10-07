import type { EnquiryRecord } from "@/lib/types";
import { DESK_SEATS, OWNED_DESK_SEATS, quoteDeskSeatId } from "@/lib/auth/desk-seats";
import { TEAM_ROLES, deskDisplayName, demoSafeId } from "@/lib/quotes/team-roles";

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
  if (o.id.startsWith("seat:")) return `${o.name} · ${o.quoteCount}`;
  const base = o.name && o.name.toLowerCase() !== o.id ? `${o.name} (${demoSafeId(o.id)})` : demoSafeId(o.id);
  return o.quoteCount > 0 ? `${base} · ${o.quoteCount}` : `${base} · none in view`;
}

/** Desk view's filter: the four desks, then anyone who works outside a desk (individual sales, Admin…). */
export function listDeskOfficersFromQuotes(rows: EnquiryRecord[]): OfficerOption[] {
  const seatCounts = new Map<string, number>(OWNED_DESK_SEATS.map((s) => [s, 0]));
  const loose: EnquiryRecord[] = [];
  for (const r of rows) {
    const seat = quoteDeskSeatId(r);
    if (seat && seatCounts.has(seat)) seatCounts.set(seat, (seatCounts.get(seat) ?? 0) + 1);
    else loose.push(r);
  }
  const desks = OWNED_DESK_SEATS.map((s) => ({
    id: `seat:${s}`,
    name: DESK_SEATS.find((x) => x.id === s)?.label ?? s,
    quoteCount: seatCounts.get(s) ?? 0,
  }));
  return [...desks, ...listOfficersFromQuotes(loose).filter((o) => o.quoteCount > 0)];
}
