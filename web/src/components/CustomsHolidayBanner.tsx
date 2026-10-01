"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useCustomsHolidays } from "@/hooks/use-atlas-data";
import { holidayAdvisoryText, relevantHolidaysForUserBranch } from "@/lib/quotes/customs-holidays";
import { useAuthStore } from "@/store/auth";

/** Non-blocking notice on the desk itself, based on whoever is quoting —
 * not the shipment's origin/destination. A Bangalore login (the default for
 * every existing user) sees one combined "is this date a holiday anywhere"
 * notice; a branch-specific login sees only their own branch's calendar.
 * Nothing here ever stops the user from continuing. */
export function CustomsHolidayBanner() {
  const user = useAuthStore((s) => s.user);
  const { data: holidays = [] } = useCustomsHolidays();
  const upcoming = useMemo(
    () => relevantHolidaysForUserBranch(user?.branch, holidays),
    [user?.branch, holidays],
  );

  if (upcoming.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <strong>Upcoming holiday{upcoming.length > 1 ? "s" : ""}:</strong>{" "}
        {upcoming.map((h) => holidayAdvisoryText(h)).join(" ")}
      </div>
    </div>
  );
}
