"use client";

import { useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, NumberInput } from "@/components/ui";
import {
  createSurchargeRow,
  type BillingUnit,
  type SurchargeRow,
} from "@/lib/pricing/surcharges";
import { focusById, focusByIdNow } from "@/lib/ui/desk-keyboard";

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
  const topAddId = emptyAddId ?? `surcharge-add-top-${title.replace(/\W+/g, "-").toLowerCase()}`;

  // After a keyboard add/delete the row set changes on the next render, so the
  // element to focus is remembered here and focused once it exists — that way
  // a whole table can be filled in and tidied without touching the mouse.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const id = pendingFocus.current;
    pendingFocus.current = null;
    focusById(id);
  }, [rows]);

  function nameIdFor(row: SurchargeRow, index: number): string {
    return index === 0 ? firstNameInputId || `surcharge-name-${row.id}` : `surcharge-name-${row.id}`;
  }

  /** Inserts a blank row after `index` (or at the end when index is -1) and moves focus into its Name. */
  function addRowAfter(index: number) {
    const fresh = createSurchargeRow({ name: "", unit: units[0] ?? "flat" });
    const at = index < 0 ? rows.length : index + 1;
    pendingFocus.current = nameIdFor(fresh, at);
    onChange([...rows.slice(0, at), fresh, ...rows.slice(at)]);
  }

  function deleteRow(index: number) {
    const remaining = rows.filter((_, j) => j !== index);
    if (!remaining.length) pendingFocus.current = topAddId;
    else if (index > 0) pendingFocus.current = `surcharge-add-${remaining[index - 1].id}`;
    else pendingFocus.current = nameIdFor(remaining[0], 0);
    onChange(remaining);
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
          id={topAddId}
          tabIndex={rows.length === 0 ? 0 : -1}
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={!enabled}
          onClick={() => addRowAfter(-1)}
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
                    id={nameIdFor(row, i)}
                    disabled={!enabled}
                    autoComplete="off"
                    name={`atlas-surcharge-name-${row.id}`}
                    className="w-28 rounded border px-1 py-1 disabled:opacity-50"
                    value={row.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && e.shiftKey && i === 0 && focusByIdNow(prevFieldTabTarget)) {
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
                      if (e.key === "Tab" && !e.shiftKey && focusByIdNow(`surcharge-add-${row.id}`)) {
                        e.preventDefault();
                      } else if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        addRowAfter(i);
                      }
                    }}
                  />
                </td>
                <td className="whitespace-nowrap p-1">
                  <button
                    type="button"
                    id={`surcharge-add-${row.id}`}
                    tabIndex={0}
                    disabled={!enabled}
                    className="mr-0.5 rounded p-0.5 text-sky-700 outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-30"
                    aria-label="Add row below"
                    title="Add a row below (Space / Enter)"
                    data-testid="surcharge-add"
                    onClick={() => addRowAfter(i)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    id={`surcharge-del-${row.id}`}
                    tabIndex={0}
                    disabled={!enabled}
                    className="rounded p-0.5 text-red-600 outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-30"
                    aria-label="Delete surcharge row"
                    title="Delete this row (Space / Enter)"
                    data-testid="surcharge-delete"
                    onClick={() => deleteRow(i)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Tab" &&
                        !e.shiftKey &&
                        i === rows.length - 1 &&
                        focusByIdNow(lastFieldTabTarget)
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
      {rows.length > 0 ? (
        <p className="mt-1.5 text-[10.5px] text-[var(--color-text-muted)]">
          Keyboard: Tab to move · Enter in Remarks, or Space on + , adds a row below · Space on the bin deletes it.
        </p>
      ) : null}
    </div>
  );
}
