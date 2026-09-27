"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { asDateValue, monthCells, parseIso, toIso, WEEKDAYS } from "@/lib/date-cells";
import { PortalDropdown } from "@/components/PortalDropdown";
import { cn } from "@/lib/utils";

/** A small, branded calendar dropdown for picking one date — built so the
 * OS's own date-picker popup (which floats wherever the browser wants, and
 * can land on top of unrelated controls) never has to be shown at all.
 *
 * Renders through PortalDropdown (into document.body), not a plain
 * `absolute` div — a `Card` in this app applies `backdrop-blur`, which
 * creates its own CSS stacking context, so a locally-positioned dropdown's
 * z-index only wins against other elements *inside that same Card*: a later
 * sibling card (e.g. the results table) still painted over the bottom of
 * the calendar, hiding the day grid. Portaling to document.body is the
 * fix this codebase already uses for every other floating panel (the
 * Actions menu, every combobox). */
export function DatePickerField({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder = "Any date",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const dateVal = asDateValue(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(dateVal || toIso(new Date()));

  useEffect(() => {
    if (dateVal) setCursor(dateVal);
  }, [dateVal]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const node = e.target as Node | null;
      if (triggerRef.current?.contains(node)) return;
      if (node instanceof Element && node.closest("[data-portal-dropdown]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cells = useMemo(() => monthCells(cursor), [cursor]);
  const cursorDate = parseIso(cursor) ?? new Date();
  const monthLabel = cursorDate.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const displayText = dateVal
    ? (parseIso(dateVal) ?? new Date()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  function commit(iso: string) {
    onChange(iso);
    setCursor(iso);
    setOpen(false);
  }

  return (
    <div>
      {label ? (
        <span className="mb-1 block text-[11px] font-semibold text-[var(--color-text-muted)]">{label}</span>
      ) : null}
      <div className="flex items-center gap-1">
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel ?? label ?? "Choose date"}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            setCursor(dateVal || toIso(new Date()));
            setOpen((v) => !v);
          }}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-left text-sm text-[var(--color-text)] hover:border-[var(--color-atlas-gold)]"
        >
          {displayText || <span className="text-[var(--color-text-muted)]">{placeholder}</span>}
        </button>
        {dateVal ? (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => onChange("")}
            className="rounded-md border border-[var(--color-border)] bg-white px-1.5 py-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:bg-slate-50"
          >
            ×
          </button>
        ) : null}
      </div>
      <PortalDropdown open={open} anchorRef={triggerRef} fitContent maxHeight={320} onDismiss={() => setOpen(false)}>
        <div role="dialog" aria-label="Choose date" className="p-2">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--color-atlas-navy)]">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              onClick={() => setCursor(toIso(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1)))}
            >
              ‹
            </button>
            <span>{monthLabel}</span>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              onClick={() => setCursor(toIso(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1)))}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[var(--color-text-muted)]">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((cell) => {
              const selected = cell.iso === dateVal;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={cn(
                    "h-7 rounded text-xs",
                    cell.inMonth ? "text-[var(--color-atlas-navy)]" : "text-slate-300",
                    selected ? "bg-[var(--color-atlas-navy)] font-bold text-white" : "hover:bg-[var(--color-atlas-gold-soft)]",
                  )}
                  onClick={() => commit(cell.iso)}
                >
                  {Number(cell.iso.slice(-2))}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-[10.5px] font-semibold text-[var(--color-atlas-navy)] hover:underline"
              onClick={() => commit(toIso(new Date()))}
            >
              Today
            </button>
            {dateVal ? (
              <button
                type="button"
                className="text-[10.5px] font-semibold text-[var(--color-text-muted)] hover:underline"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </PortalDropdown>
    </div>
  );
}
