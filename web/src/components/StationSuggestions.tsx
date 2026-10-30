"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { stationLabel } from "@/lib/circulars/stations";
import { suggestStations } from "@/lib/circulars/suggest-station";
import type { CircularRecord } from "@/lib/types";

/**
 * A banner on Circulars: "32 circulars have no station — Vertex can suggest one for 20." Review opens the list with every
 * suggestion ticked; nothing changes until Apply. Circulars with no airport code in the title stay for a person to label.
 */
export function StationSuggestions({
  circulars,
  onApply,
}: {
  circulars: CircularRecord[];
  onApply: (picks: Array<{ id: string; station: string }>) => Promise<void>;
}) {
  const unlabelled = useMemo(() => circulars.filter((c) => !c.station || !stationLabel(c.station).includes("(")), [circulars]);
  const suggestions = useMemo(() => suggestStations(unlabelled), [unlabelled]);
  const [open, setOpen] = useState(false);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  if (!unlabelled.length || !suggestions.length) return null;
  const byId = new Map(circulars.map((c) => [c.id, c]));
  const chosen = suggestions.filter((s) => !unticked.has(s.circularId));

  async function apply() {
    setBusy(true);
    try {
      await onApply(chosen.map((s) => ({ id: s.circularId, station: s.station.name })));
      setOpen(false);
      setUnticked(new Set());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50 py-3" data-testid="station-suggestions">
      <div className="flex flex-wrap items-center gap-3">
        <MapPin className="h-5 w-5 shrink-0 text-amber-800" />
        <div className="min-w-[14rem] flex-1">
          <div className="text-sm font-bold text-amber-950">
            {unlabelled.length} circular{unlabelled.length === 1 ? " has" : "s have"} no station
          </div>
          <div className="text-xs text-amber-900">
            Vertex can suggest a station for {suggestions.length} of them from the airport code in the title, such as EK_BLR.
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide suggestions" : "Review suggestions"}
        </Button>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 rounded-lg bg-white p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-bold">Suggested stations ({suggestions.length})</span>
            <span className="text-xs text-[var(--color-text-muted)]">Untick any that look wrong. Nothing changes until you press Apply.</span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {suggestions.map((s) => {
              const c = byId.get(s.circularId);
              const on = !unticked.has(s.circularId);
              return (
                <li key={s.circularId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    aria-label={`Use ${stationLabel(s.station.name)} for ${c?.title || c?.fileName || "this circular"}`}
                    onChange={() =>
                      setUnticked((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.circularId)) next.delete(s.circularId);
                        else next.add(s.circularId);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c?.title || c?.fileName || "Untitled"}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{[c?.carrier, c?.fileName].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-900">{stationLabel(s.station.name)}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">from {s.from}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || chosen.length === 0} onClick={() => void apply()}>
              {busy ? "Applying…" : `Apply ${chosen.length} station${chosen.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
