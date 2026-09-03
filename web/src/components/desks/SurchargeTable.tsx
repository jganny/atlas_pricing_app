"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  createSurchargeRow,
  type BillingUnit,
  type SurchargeRow,
} from "@/lib/pricing/surcharges";

const UNIT_OPTIONS: Array<{ value: BillingUnit; label: string }> = [
  { value: "kg", label: "Per kg" },
  { value: "flat", label: "Flat" },
  { value: "cbm", label: "Per CBM/RT" },
  { value: "container", label: "Per container" },
];

export function SurchargeTable({
  title,
  enabled,
  onEnabledChange,
  rows,
  onChange,
  units = ["kg", "flat"],
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  rows: SurchargeRow[];
  onChange: (rows: SurchargeRow[]) => void;
  units?: BillingUnit[];
}) {
  function update(index: number, patch: Partial<SurchargeRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div
      className={`rounded-lg border border-[var(--color-border)] p-3 ${
        enabled ? "bg-slate-50/60" : "opacity-60"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-atlas-navy)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          {title}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              enabled ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
            }`}
          >
            {enabled ? "✓ Included" : "✕ Excluded"}
          </span>
        </label>
        <Button
          type="button"
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={!enabled}
          onClick={() =>
            onChange([...rows, createSurchargeRow({ name: "", unit: units[0] ?? "flat" })])
          }
        >
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-[10px] uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-1 py-1 text-left">Name</th>
              <th className="px-1 py-1">Sell</th>
              <th className="px-1 py-1">Buy</th>
              <th className="px-1 py-1">Unit</th>
              <th className="px-1 py-1 text-left">Remarks</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-t border-[var(--color-border)]">
                <td className="p-1">
                  <input
                    disabled={!enabled}
                    className="w-28 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    step="0.01"
                    disabled={!enabled}
                    className="w-20 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.sell}
                    onChange={(e) => update(i, { sell: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    step="0.01"
                    disabled={!enabled}
                    className="w-20 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.buy}
                    onChange={(e) => update(i, { buy: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1">
                  <select
                    disabled={!enabled}
                    className="rounded border px-1 py-1 disabled:opacity-50"
                    value={row.unit}
                    onChange={(e) => update(i, { unit: e.target.value as BillingUnit })}
                  >
                    {UNIT_OPTIONS.filter((u) => units.includes(u.value)).map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <input
                    disabled={!enabled}
                    className="w-24 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.remarks}
                    onChange={(e) => update(i, { remarks: e.target.value })}
                    placeholder="Optional"
                  />
                </td>
                <td className="p-1">
                  <button
                    type="button"
                    disabled={!enabled || rows.length <= 1}
                    className="text-red-600 disabled:opacity-30"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
