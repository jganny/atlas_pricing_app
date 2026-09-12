"use client";

import { FlaskConical } from "lucide-react";
import { getEnvironmentLabel } from "@/lib/api";

/** Mock-only warning. Live cutover copy stays off the daily chrome. */
export function MockBanner() {
  const label = getEnvironmentLabel();
  if (!label.toLowerCase().includes("mock")) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-amber-950">
      <FlaskConical className="h-3.5 w-3.5" />
      {label} — demo data only
    </div>
  );
}
