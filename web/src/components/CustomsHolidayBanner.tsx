"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useCustomsHolidays } from "@/hooks/use-atlas-data";
import { upcomingHolidaysForLocations } from "@/lib/quotes/customs-holidays";

/** Non-blocking notice on the desk itself — upcoming branch holidays for
 * whatever origin/destination is currently entered. Nothing here ever stops
 * the user from continuing; it's informational only. */
export function CustomsHolidayBanner({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  const { data: holidays = [] } = useCustomsHolidays();
  const upcoming = useMemo(
    () => upcomingHolidaysForLocations([origin, destination], holidays),
    [origin, destination, holidays],
  );

  if (upcoming.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <strong>Upcoming branch holiday{upcoming.length > 1 ? "s" : ""}:</strong>{" "}
        {upcoming
          .map((h) => {
            const d = new Date(`${h.date}T00:00:00`);
            return `${h.branch} closed for ${h.name} (${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`;
          })
          .join(" · ")}
      </div>
    </div>
  );
}
