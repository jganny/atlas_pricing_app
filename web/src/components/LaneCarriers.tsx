"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useDirectory } from "@/hooks/use-atlas-data";
import { loadAirportCountries } from "@/lib/directory/airport-countries";
import { countryOfPlace } from "@/lib/directory/coverage";
import { laneChips, MAX_LANE_CHIPS, type CarrierCodeRow } from "@/lib/pricing/lane-carriers";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { AirTariff, SeaTariff } from "@/lib/types";
import { cn } from "@/lib/utils";

const NONE: never[] = [];
let codesCache: { air: CarrierCodeRow[]; sea: CarrierCodeRow[] } | null = null;

async function loadCodes() {
  if (codesCache) return codesCache;
  const base = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "" : "/app";
  try {
    codesCache = (await (await fetch(`${base}/data/carriers-slim.json`, { cache: "force-cache" })).json()) as { air: CarrierCodeRow[]; sea: CarrierCodeRow[] };
  } catch {
    codesCache = { air: [], sea: [] };
  }
  return codesCache;
}

const codeOf = (place: string) => (place.split(" - ")[0] || "").trim().toUpperCase();

/**
 * One quiet row on the Carriers step: the carriers that serve this lane, by short code.
 * Green = a rate is on file. Red = serves it, no rate on file yet. Tap one, or press Shift+1…9, to add it.
 */
export function LaneCarriers({
  mode,
  origin,
  destination,
  seaMode,
  airTariffs,
  seaTariffs,
  existing,
  onAdd,
}: {
  mode: "air" | "sea";
  origin: string;
  destination: string;
  seaMode?: string;
  airTariffs: AirTariff[];
  seaTariffs: SeaTariff[];
  existing: string[];
  onAdd: (name: string) => void;
}) {
  const { data } = useDirectory();
  const contacts = data ?? NONE;
  const [airports, setAirports] = useState<Map<string, string>>(new Map());
  const [codes, setCodes] = useState<CarrierCodeRow[]>([]);
  useEffect(() => {
    void loadAirportCountries().then(setAirports);
    void loadCodes().then((c) => setCodes(mode === "air" ? c.air : c.sea));
  }, [mode]);

  const chips = useMemo(
    () =>
      laneChips({
        mode,
        originCode: codeOf(origin),
        destCode: codeOf(destination),
        originCountry: countryOfPlace(origin, { airports }),
        destCountry: countryOfPlace(destination, { airports }),
        seaMode,
        airTariffs,
        seaTariffs,
        contacts,
        codes,
      }),
    [mode, origin, destination, seaMode, airTariffs, seaTariffs, contacts, codes, airports],
  );
  const shown = chips.slice(0, MAX_LANE_CHIPS);
  const added = new Set(existing.map(normalizeCarrierName));

  // Shift+1…9 adds the numbered carrier (never while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      const m = /^Digit([1-9])$/.exec(e.code);
      if (!m) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const chip = shown[Number(m[1]) - 1];
      if (!chip || added.has(normalizeCarrierName(chip.name))) return;
      e.preventDefault();
      onAdd(chip.name);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2" data-testid="lane-carriers">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">This lane</span>
      {shown.map((c, i) => {
        const done = added.has(normalizeCarrierName(c.name));
        return (
          <button
            key={`${c.code}-${c.name}`}
            type="button"
            disabled={done}
            onClick={() => onAdd(c.name)}
            title={`${c.name} · ${c.status === "rate" ? "rate on file" : "no rate on file yet"}${done ? " · added" : ` · Shift+${i + 1}`}`}
            aria-label={`${done ? "Added" : "Add"} ${c.name}, ${c.status === "rate" ? "rate on file" : "no rate on file"}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-extrabold tracking-wide",
              c.status === "rate" ? "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200" : "border-red-300 bg-red-100 text-red-800 hover:bg-red-200",
              done && "opacity-50",
            )}
          >
            {done ? <Check className="h-3 w-3" /> : <span className="text-[9px] font-bold opacity-60">{i + 1}</span>}
            {c.code}
          </button>
        );
      })}
      {chips.length > shown.length ? <span className="text-[11px] text-[var(--color-text-muted)]">+{chips.length - shown.length}</span> : null}
      <span className="ml-auto hidden text-[10px] text-[var(--color-text-muted)] sm:inline">green rate on file · red none yet · Shift+1–9</span>
    </div>
  );
}
