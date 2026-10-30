/**
 * Quote validity belongs to each airline, liner or co-loader — it follows that carrier's rates, so there is no
 * standard period and nothing is filled in automatically. The desk picks a date (or types its own words,
 * e.g. "subject to space"); a copy or an amendment keeps whatever was set, and a date that has passed is flagged.
 */
import { parseIso, toIso } from "@/lib/date-cells";

/** "2026-11-14" -> "14 Nov 2026"; anything else is shown as typed. */
export function formatValidity(value: string | undefined | null): string {
  const v = String(value ?? "").trim();
  const d = parseIso(v);
  if (!d) return v;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export type ValidityStatus = "none" | "text" | "ok" | "soon" | "expired";

/** For the little hint under the field: nothing set, has the date passed, or is it within 3 days? */
export function validityStatus(value: string | undefined | null, now: Date = new Date()): ValidityStatus {
  const v = String(value ?? "").trim();
  if (!v) return "none";
  const until = parseIso(v);
  if (!until) return "text";
  const today = parseIso(toIso(now)) as Date;
  const days = Math.round((until.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 3) return "soon";
  return "ok";
}
