/** Pure helpers for building audit-trail entries (no Firebase, fully testable). */

export type AuditAction =
  | "lead.create"
  | "lead.update"
  | "lead.status"
  | "account.create"
  | "account.update"
  | "account.delete"
  | "contact.add"
  | "contact.delete"
  | "target.save"
  | "target.delete"
  | "territory.add"
  | "territory.delete"
  | "quote.save"
  | "quote.update"
  | "quote.delete"
  | "seat.assign"
  | "seat.reset";

export type AuditEntity = "lead" | "account" | "contact" | "target" | "territory" | "quote" | "seat";

export interface FieldChange {
  from?: string;
  to?: string;
}

const MAX_VALUE = 200;
const MAX_FIELDS = 20;
const MAX_SUMMARY = 300;

function show(v: unknown): string {
  if (v == null || v === "") return "";
  const s = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s;
}

/** Changed fields only, values stringified and truncated. Empty and missing are treated as equal. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const f of fields) {
    const a = show(before[f]);
    const b = show(after[f]);
    if (a === b) continue;
    out[f] = { from: a, to: b };
    if (Object.keys(out).length >= MAX_FIELDS) break;
  }
  return out;
}

export function summarizeChanges(changes: Record<string, FieldChange>): string {
  const parts = Object.entries(changes).map(([k, c]) => `${k}: ${c.from || "—"} → ${c.to || "—"}`);
  const s = parts.join("; ");
  return s.length > MAX_SUMMARY ? `${s.slice(0, MAX_SUMMARY - 1)}…` : s;
}

export function clip(s: string | undefined, n = MAX_SUMMARY): string {
  const v = (s || "").trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
}
