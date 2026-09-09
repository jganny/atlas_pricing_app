"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { type QuoteLane } from "@/lib/quotes/lanes";

export type { QuoteLane };

export function newLane(partial: Partial<QuoteLane> = {}): QuoteLane {
  return {
    id: partial.id ?? `lane_${Math.random().toString(36).slice(2, 8)}`,
    origin: partial.origin ?? "",
    destination: partial.destination ?? "",
  };
}

export function LaneChips({
  lanes,
  activeId,
  onSelect,
  onAdd,
  onRemove,
}: {
  lanes: QuoteLane[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lanes.map((lane, i) => {
        const active = lane.id === activeId;
        const label =
          lane.origin && lane.destination
            ? `${lane.origin.split("—")[0].trim()} → ${lane.destination.split("—")[0].trim()}`
            : `Lane ${i + 1}`;
        return (
          <button
            key={lane.id}
            type="button"
            onClick={() => onSelect(lane.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              active
                ? "border-teal-500 bg-teal-50 text-[var(--color-atlas-navy)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-sky-300"
            }`}
          >
            {label}
            {lanes.length > 1 ? (
              <span
                role="button"
                tabIndex={-1}
                className="rounded-full p-0.5 hover:bg-rose-100 hover:text-rose-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(lane.id);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
          </button>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" />
        Add lane
      </Button>
    </div>
  );
}
