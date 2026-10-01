/** Branch/office holiday calendar — matches a quote's origin/destination
 * city against the relevant branch, and flags anything within the lead window. */

export interface CustomsHoliday {
  id: string;
  branch: string;
  date: string; // YYYY-MM-DD
  name: string;
  notes?: string;
}

export const DEFAULT_LEAD_DAYS = 14;

/** A branch name matches a quote's origin/destination text as a loose,
 * case-insensitive substring — "BOM - Mumbai, Chhatrapati..." matches "Mumbai". */
export function locationMatchesBranch(location: string, branch: string): boolean {
  const loc = location.trim().toLowerCase();
  const b = branch.trim().toLowerCase();
  if (!loc || !b) return false;
  return loc.includes(b);
}

export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const target = new Date(`${dateIso}T00:00:00`).getTime();
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

/** Holidays for a branch, within [0, leadDays] days from now — never past, never too far out. */
export function upcomingHolidaysForBranch(
  branch: string,
  holidays: CustomsHoliday[],
  leadDays: number = DEFAULT_LEAD_DAYS,
  now: Date = new Date(),
): CustomsHoliday[] {
  return holidays
    .filter((h) => h.branch.trim().toLowerCase() === branch.trim().toLowerCase())
    .filter((h) => {
      const d = daysUntil(h.date, now);
      return d >= 0 && d <= leadDays;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Holidays relevant to a quote's origin/destination text — checks every
 * known branch name against both strings, not just an exact city match. */
export function upcomingHolidaysForLocations(
  locations: Array<string | undefined>,
  holidays: CustomsHoliday[],
  leadDays: number = DEFAULT_LEAD_DAYS,
  now: Date = new Date(),
): CustomsHoliday[] {
  const branches = Array.from(new Set(holidays.map((h) => h.branch)));
  const matchedBranches = branches.filter((b) =>
    locations.some((loc) => loc && locationMatchesBranch(loc, b)),
  );
  const seen = new Set<string>();
  const out: CustomsHoliday[] = [];
  for (const branch of matchedBranches) {
    for (const h of upcomingHolidaysForBranch(branch, holidays, leadDays, now)) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      out.push(h);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function holidayAdvisoryText(h: CustomsHoliday): string {
  const d = new Date(`${h.date}T00:00:00`);
  const formatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${h.branch} is closed for ${h.name} on ${formatted}.`;
}
