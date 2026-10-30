/**
 * Quote validity as a real date.
 * - New quote: today + 15 days, as a date.
 * - Duplicate: the same length of validity, counted from today (a copied date would already be stale).
 * - Amend: untouched — amending a quote does not quietly extend how long its rates hold.
 * Free text such as "15 days" or "subject to space" is left exactly as typed.
 */
import { addDays, parseIso, toIso } from "@/lib/date-cells";

export const DEFAULT_VALIDITY_DAYS = 15;

export function defaultValidity(from: Date = new Date()): string {
  return addDays(DEFAULT_VALIDITY_DAYS, from);
}

/** "2026-11-14" -> "14 Nov 2026"; anything else is shown as typed. */
export function formatValidity(value: string | undefined | null): string {
  const v = String(value ?? "").trim();
  const d = parseIso(v);
  if (!d) return v;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** The validity a duplicate starts with. `quotedOn` is the original quote's own date (YYYY-MM-DD). */
export function validityOnDuplicate(value: string | undefined | null, quotedOn: string | undefined | null, now: Date = new Date()): string {
  const v = String(value ?? "").trim();
  const until = parseIso(v);
  if (!until) return v;
  const from = parseIso(String(quotedOn ?? "").slice(0, 10));
  const span = from ? Math.round((until.getTime() - from.getTime()) / 86_400_000) : DEFAULT_VALIDITY_DAYS;
  return addDays(span > 0 ? span : DEFAULT_VALIDITY_DAYS, now);
}

export type ValidityStatus = "text" | "ok" | "soon" | "expired";

/** For the little hint under the field: has the date passed, or is it within 3 days? */
export function validityStatus(value: string | undefined | null, now: Date = new Date()): ValidityStatus {
  const until = parseIso(String(value ?? "").trim());
  if (!until) return "text";
  const today = parseIso(toIso(now)) as Date;
  const days = Math.round((until.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "ok";
}
