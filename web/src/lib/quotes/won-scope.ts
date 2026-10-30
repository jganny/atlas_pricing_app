/**
 * Whose Won follow-up is it? Each user sees only their own pending details; the admin sees everyone's.
 * "Own" follows the desk, not the person (see desk-seats): the seat that won the quote keeps the follow-up
 * when staff change desks. A row stamped at conversion says so itself; older rows are matched to their quote;
 * the last resort is the login that pressed Won.
 */
import { belongsToViewersDesk, quoteOwnerLabel, quoteDeskSeatId } from "@/lib/auth/desk-seats";
import { missingWonFields, type WonFollowUpValues } from "./won-followups";

export interface WonOwnerHint {
  deskSeat?: string | null;
  creator?: string | null;
  creatorName?: string | null;
}

export interface WonScopedRow extends WonFollowUpValues {
  quoteId: string;
  wonAt: string;
  ownerSeat?: string;
  ownerLogin?: string;
  updatedBy?: string;
}

/** The desk / login this row belongs to, best evidence first. */
export function wonOwnerOf(row: WonScopedRow, quote?: WonOwnerHint | null): WonOwnerHint {
  if (row.ownerSeat || row.ownerLogin) return { deskSeat: row.ownerSeat, creator: row.ownerLogin };
  if (quote && (quote.deskSeat || quote.creator)) return quote;
  return { creator: row.updatedBy };
}

export function wonRowsForViewer<T extends WonScopedRow>(
  rows: T[],
  username: string | undefined | null,
  admin: boolean,
  quoteOf: (quoteId: string) => WonOwnerHint | undefined,
): T[] {
  if (admin) return rows;
  return rows.filter((r) => belongsToViewersDesk(wonOwnerOf(r, quoteOf(r.quoteId)), username));
}

/** "Air Nom" / "Ganny" — what to call the owner on the admin's by-person bar. */
export function wonOwnerKey(row: WonScopedRow, quote?: WonOwnerHint | null): { key: string; label: string } {
  const owner = wonOwnerOf(row, quote);
  const seat = quoteDeskSeatId(owner);
  const label = quoteOwnerLabel(owner);
  return { key: seat ?? (owner.creator || "").toLowerCase(), label: label && label !== "—" ? label : "Unassigned" };
}

/** Pending counts per owner, biggest pile first — the admin's overview. */
export function pendingByOwner<T extends WonScopedRow>(
  rows: T[],
  quoteOf: (quoteId: string) => WonOwnerHint | undefined,
): { key: string; label: string; pending: number; overdue: number }[] {
  const map = new Map<string, { key: string; label: string; pending: number; overdue: number }>();
  for (const r of rows) {
    if (missingWonFields(r).length === 0) continue;
    const { key, label } = wonOwnerKey(r, quoteOf(r.quoteId));
    const slot = map.get(key) ?? { key, label, pending: 0, overdue: 0 };
    slot.pending += 1;
    if (Date.now() - new Date(r.wonAt).getTime() >= 8 * 86_400_000) slot.overdue += 1;
    map.set(key, slot);
  }
  return [...map.values()].sort((a, b) => b.pending - a.pending);
}
