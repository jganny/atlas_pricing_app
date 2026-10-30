"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { agoLabel, placeCode, suggestCarriers } from "@/lib/quotes/carrier-suggestions";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";

const SHOWN = 3;

/**
 * "Vertex suggests" on the Carriers step: the airlines or liners this team has quoted on this lane before,
 * most-used first, with whether a tariff is on file. One tap adds the carrier; nothing is chosen for the user.
 */
export function CarrierSuggestions({
  mode,
  origin,
  destination,
  hasTariff,
  existing,
  onAdd,
}: {
  mode: "air" | "sea";
  origin: string;
  destination: string;
  hasTariff: (carrierName: string) => boolean;
  existing: string[];
  onAdd: (name: string) => void;
}) {
  const { data: enquiries = [] } = useEnquiries();
  const [all, setAll] = useState(false);
  const list = suggestCarriers({ enquiries, mode, origin, destination, hasTariff });
  if (!list.length) return null;
  const added = new Set(existing.map(normalizeCarrierName));
  const shown = all ? list.slice(0, 8) : list.slice(0, SHOWN);
  const noun = mode === "air" ? "airline" : "liner or co-loader";
  return (
    <div className="space-y-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2" data-testid="carrier-suggestions">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-[var(--color-atlas-navy)]">
          <Sparkles className="h-3.5 w-3.5" /> Vertex suggests for {placeCode(origin)} → {placeCode(destination)}
        </span>
        <span className="text-[var(--color-text-muted)]">from earlier quotes on this lane</span>
      </div>
      <ul>
        {shown.map((s, i) => {
          const done = added.has(normalizeCarrierName(s.name));
          return (
            <li key={s.name} className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] py-1.5 first:border-t-0 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${i === 0 ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"}`}>
                {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}
              </span>
              <span className="min-w-0 flex-1">
                <b>{s.name}</b>{" "}
                <span className="text-xs text-[var(--color-text-muted)]">
                  used {s.uses} time{s.uses === 1 ? "" : "s"}
                  {s.lastUsed ? ` · last ${agoLabel(s.lastUsed)}` : ""} · {s.hasTariff ? "tariff on file" : "no tariff on file, type the rate"}
                </span>
              </span>
              <Button type="button" size="sm" variant="secondary" disabled={done} onClick={() => onAdd(s.name)} aria-label={`${done ? "Added" : "Use"} ${s.name} as ${noun}`}>
                {done ? <><Check className="h-3.5 w-3.5" /> Added</> : `Use ${s.name}`}
              </Button>
            </li>
          );
        })}
      </ul>
      {list.length > SHOWN ? (
        <button type="button" className="text-xs font-semibold text-sky-700 hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `See all (${Math.min(list.length, 8)})`}
        </button>
      ) : null}
    </div>
  );
}
