/** Sales pipeline: logging visits to existing companies, deleting a mistaken entry, and spotting lead handovers. */
import { activityDay } from "./activity-log";
import type { Account, LeadActivity, SalesLead } from "@/lib/types";

const norm = (s?: string | null) => (s || "").trim().toLowerCase();
export const DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Whoever logged an entry may delete it for 2 hours; after that only an admin can. */
export function canDeleteActivity(
  a: Pick<LeadActivity, "createdBy" | "createdAt">,
  username: string | undefined | null,
  isAdmin: boolean,
  now = Date.now(),
): boolean {
  if (!username) return false;
  if (isAdmin) return true;
  const logged = Date.parse(a.createdAt);
  if (Number.isNaN(logged)) return false;
  return norm(a.createdBy) === norm(username) && now - logged <= DELETE_WINDOW_MS;
}

/** Minutes the logger still has to delete their own entry, or 0. */
export function deleteMinutesLeft(a: Pick<LeadActivity, "createdAt">, now = Date.now()): number {
  const logged = Date.parse(a.createdAt);
  if (Number.isNaN(logged)) return 0;
  return Math.max(0, Math.ceil((DELETE_WINDOW_MS - (now - logged)) / 60000));
}

/** A lead given to someone other than the person creating it. */
export function isHandover(actor: string | undefined | null, owner: string | undefined | null): boolean {
  return !!norm(owner) && !!norm(actor) && norm(owner) !== norm(actor);
}

export interface VisitCandidate {
  key: string;
  kind: "lead" | "account" | "new";
  id: string;
  company: string;
  detail: string;
}

/**
 * Companies a visit can be logged against: the person's own leads, plus accounts that have no lead yet.
 * Nothing is offered until at least two letters are typed.
 */
export function visitCandidates(leads: SalesLead[], accounts: Account[], query: string, limit = 8): VisitCandidate[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const leadNames = new Set(leads.map((l) => norm(l.company)));
  const linkedAccountIds = new Set(leads.map((l) => l.accountId).filter(Boolean));
  const fromLeads: VisitCandidate[] = leads
    .filter((l) => norm(l.company).includes(q))
    .map((l) => ({ key: `lead:${l.id}`, kind: "lead" as const, id: l.id, company: l.company, detail: `${l.status}${l.contactName ? ` · ${l.contactName}` : ""}` }));
  const fromAccounts: VisitCandidate[] = accounts
    .filter((a) => norm(a.name).includes(q) && !leadNames.has(norm(a.name)) && !linkedAccountIds.has(a.id))
    .map((a) => ({ key: `account:${a.id}`, kind: "account" as const, id: a.id, company: a.name, detail: a.accountType ? `account · ${a.accountType}` : "account" }));
  const rank = (c: VisitCandidate) => (norm(c.company).startsWith(q) ? 0 : 1);
  return [...fromLeads, ...fromAccounts].sort((a, b) => rank(a) - rank(b) || a.company.localeCompare(b.company)).slice(0, limit);
}

export interface HandoverEntry {
  id: string;
  atIso: string;
  from: string;
  to: string;
  company: string;
}

interface AuditLike {
  id: string;
  atIso: string;
  actor: string;
  action: string;
  entityLabel: string;
  changes?: Record<string, { from?: string; to?: string }>;
}

/** The audit-log rows that are lead handovers, newest first. */
export function handoversFrom(records: AuditLike[]): HandoverEntry[] {
  return records
    .filter((r) => r.action === "lead.handover")
    .map((r) => ({ id: r.id, atIso: r.atIso, from: r.changes?.owner?.from || r.actor, to: r.changes?.owner?.to || "", company: r.entityLabel }))
    .sort((a, b) => b.atIso.localeCompare(a.atIso));
}

export function unseenHandovers(entries: HandoverEntry[], seenAtIso: string): number {
  return entries.filter((e) => e.atIso > seenAtIso).length;
}

/** "Last visit" day for a lead, from its activity list (visit date, not when it was typed in). */
export function lastVisitDay(rows: LeadActivity[]): string | null {
  const visits = rows.filter((r) => r.type === "meeting").map(activityDay).sort();
  return visits.length ? visits[visits.length - 1] : null;
}
