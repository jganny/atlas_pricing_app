/** Visit / meeting log on a sales lead — the date a visit happened, what was discussed, and the next step. */
import type { LeadActivity } from "@/lib/types";

/** Today in the user's own calendar as YYYY-MM-DD (not UTC, so late evening visits don't land on tomorrow). */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The day to show for an entry: when the visit happened, else when it was logged (older entries). */
export function activityDay(a: Pick<LeadActivity, "activityDate" | "createdAt">): string {
  return a.activityDate || a.createdAt.slice(0, 10);
}

/** Newest visit first; ties go to whichever was logged last. */
export function sortActivities(rows: LeadActivity[]): LeadActivity[] {
  return [...rows].sort((a, b) => activityDay(b).localeCompare(activityDay(a)) || b.createdAt.localeCompare(a.createdAt));
}

export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export interface VisitInput {
  body: string;
  activityDate: string;
  nextStep: string;
  followUpDate: string;
}

/** What the form needs before it can save, or null when it's fine. A visit can't be dated in the future. */
export function visitProblem(v: VisitInput, today = todayISO()): string | null {
  if (!v.body.trim() && !v.nextStep.trim()) return "Write what was discussed.";
  if (!v.activityDate) return "Choose the date of the visit.";
  if (v.activityDate > today) return "A visit can't be dated in the future.";
  if (v.followUpDate && v.followUpDate < v.activityDate) return "The follow-up date can't be before the visit.";
  return null;
}
