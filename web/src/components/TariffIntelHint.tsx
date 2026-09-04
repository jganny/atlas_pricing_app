"use client";

import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui";

/** Lightweight tariff intelligence — lane tips from Circulars count + history cues. */

export function TariffIntelHint({
  mode,
  origin,
  destination,
  tariffCount,
}: {
  mode: "air" | "sea";
  origin: string;
  destination: string;
  tariffCount: number;
}) {
  const tip = useMemo(() => {
    const o = origin.trim().toUpperCase().slice(0, 3);
    const d = destination.trim().toUpperCase().slice(0, 3);
    if (!o || !d) {
      return "Enter POL/POD to see Circulars coverage and desk tips for this lane.";
    }
    if (tariffCount === 0) {
      return `No published ${mode} Circulars for ${o}→${d} yet — paste rates manually or publish from Circulars Excel.`;
    }
    if (tariffCount === 1) {
      return `1 Circulars ${mode} tariff covers ${o}→${d}. Prefer Load Circulars before locking sell.`;
    }
    return `${tariffCount} Circulars ${mode} tariffs available — compare carriers before selecting quoted.`;
  }, [mode, origin, destination, tariffCount]);

  return (
    <Card className="border-amber-100 bg-amber-50/50 py-2">
      <div className="flex items-start gap-2 text-xs text-amber-950">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{tip}</span>
      </div>
    </Card>
  );
}
