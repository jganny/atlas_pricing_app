"use client";

import { FlaskConical, Wifi } from "lucide-react";
import { getEnvironmentLabel, useLiveData } from "@/lib/api";

export function MockBanner() {
  const label = getEnvironmentLabel();
  const isMock = label.toLowerCase().includes("mock");

  if (isMock) {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-xs font-bold text-amber-950">
        <FlaskConical className="h-3.5 w-3.5" />
        {label} — no Firebase connection · demo data only · deploy blocked until you approve
      </div>
    );
  }

  if (useLiveData) {
    return (
      <div className="flex items-center justify-center gap-2 bg-emerald-600 px-3 py-1.5 text-center text-xs font-bold text-white">
        <Wifi className="h-3.5 w-3.5" />
        {label} — live sync · ⌘K palette · save enabled · migration on hold until full parity
      </div>
    );
  }

  return null;
}
