"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, NumberInput } from "@/components/ui";
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

function focusTabTarget(id: string | undefined): boolean {
  if (!id) return false;
  const el = document.getElementById(id);
  if (!(el instanceof HTMLElement)) return false;
  if (
    (el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled
  ) {
    return false;
  }
  el.focus();
  return document.activeElement === el;
}

export function SurchargeTable({
  title,
  enabled,
  onEnabledChange,
  rows,
  onChange,
  units = ["kg", "flat"],
  lastFieldTabTarget,
  firstNameInputId,
  prevFieldTabTarget,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  rows: SurchargeRow[];
  onChange: (rows: SurchargeRow[]) => void;
  units?: BillingUnit[];
  /** When set, Tab on the last row’s delete control jumps here (e.g. dest Name or Next · Terms). */
  lastFieldTabTarget?: string;
  /** Stable id on the first Name field (or Add, if empty) so the previous table can Tab into it. */
  firstNameInputId?: string;
  /** Shift+Tab from the first Name field jumps here (e.g. previous table’s last Delete). */
  prevFieldTabTarget?: string;
}) {
  function update(index: number, patch: Partial<SurchargeRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  const emptyAddId = rows.length === 0 ? firstNameInputId : undefined;

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
          id={emptyAddId}
          tabIndex={emptyAddId ? 0 : -1}
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
              <th className="px-1 py-1" title="Charged to customer">
                Sell (customer)
              </th>
              <th className="px-1 py-1" title="Your cost">
                Buy (cost)
              </th>
              <th className="px-1 py-1">Unit</th>
              <th className="px-1 py-1 text-left">Remarks</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-1 py-2 text-[11px] text-[var(--color-text-muted)]">
                  No charges on this heading. Add one if you need a fee line.
                </td>
              </tr>
            ) : null}
            {rows.map((row, i) => (
              <tr key={row.id} className="border-t border-[var(--color-border)]">
                <td className="p-1">
                  <input
                    id={i === 0 ? firstNameInputId || `surcharge-name-${row.id}` : `surcharge-name-${row.id}`}
                    disabled={!enabled}
                    autoComplete="off"
                    name={`atlas-surcharge-name-${row.id}`}
                    className="w-28 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && e.shiftKey && i === 0 && focusTabTarget(prevFieldTabTarget)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </td>
                <td className="p-1">
                  <NumberInput
                    disabled={!enabled}
                    step="0.01"
                    className="mt-0 w-20 px-1 py-1 text-xs"
                    value={row.sell}
                    onValueChange={(n) => update(i, { sell: n })}
                  />
                </td>
                <td className="p-1">
                  <NumberInput
                    disabled={!enabled}
                    step="0.01"
                    className="mt-0 w-20 px-1 py-1 text-xs"
                    value={row.buy}
                    onValueChange={(n) => update(i, { buy: n })}
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
                    autoComplete="off"
                    name={`atlas-surcharge-remarks-${row.id}`}
                    className="w-24 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.remarks}
                    onChange={(e) => update(i, { remarks: e.target.value })}
                    placeholder="Optional"
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey && focusTabTarget(`surcharge-del-${row.id}`)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </td>
                <td className="p-1">
                  <button
                    type="button"
                    id={`surcharge-del-${row.id}`}
                    tabIndex={0}
                    disabled={!enabled}
                    className="rounded p-0.5 text-red-600 outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-30"
                    aria-label="Delete surcharge row"
                    data-testid="surcharge-delete"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Tab" &&
                        !e.shiftKey &&
                        i === rows.length - 1 &&
                        focusTabTarget(lastFieldTabTarget)
                      ) {
                        e.preventDefault();
                      }
                    }}
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
