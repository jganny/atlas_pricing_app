"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEventHandler } from "react";
import { Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDays, asDateValue, monthCells, parseIso, toIso, WEEKDAYS } from "@/lib/date-cells";

const PRESETS = [
  { label: "+7d", days: 7 },
  { label: "+15d", days: 15 },
  { label: "+30d", days: 30 },
] as const;

/** Validity: mini calendar + day presets + free text (“15 days”). */
export function ValidityField({
  value,
  onChange,
  label = "Validity",
  textInputId,
  onTextKeyDown,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  textInputId?: string;
  onTextKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
  const dateVal = asDateValue(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const [calUp, setCalUp] = useState(false);

  // Keep the calendar inside the window: open above the field when it would run off the bottom.
  useLayoutEffect(() => {
    if (!calOpen) {
      setCalUp(false);
      return;
    }
    const el = calRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8 && root.getBoundingClientRect().top - 8 > r.height) setCalUp(true);
  }, [calOpen]);
  const [cursor, setCursor] = useState(dateVal || addDays(0));

  useEffect(() => {
    if (dateVal) setCursor(dateVal);
  }, [dateVal]);

  useEffect(() => {
    if (!calOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setCalOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [calOpen]);

  const cells = useMemo(() => monthCells(cursor), [cursor]);
  const cursorDate = parseIso(cursor) ?? new Date();
  const monthLabel = cursorDate.toLocaleString("en-GB", { month: "long", year: "numeric" });

  function commit(iso: string) {
    onChange(iso);
    setCursor(iso);
    setCalOpen(false);
  }

  function moveCursor(days: number) {
    setCursor((c) => addDays(days, parseIso(c) ?? new Date()));
    setCalOpen(true);
  }

  /** Native Safari/Chrome pickers need Space + Enter. Only open our overlay if showPicker is unavailable. */
  function openChooser() {
    const el = rootRef.current?.querySelector<HTMLInputElement>('[data-testid="validity-date"]');
    if (el && typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* showPicker can throw if the input is not user-activated */
      }
    }
    setCursor(dateVal || addDays(0));
    setCalOpen(true);
  }

  return (
    <div ref={rootRef} className="relative">
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          className="mt-0 max-w-[11rem]"
          value={dateVal}
          data-testid="validity-date"
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => onChange(e.currentTarget.value)}
          onFocus={() => {
            setCursor(dateVal || addDays(0));
          }}
          onKeyUp={(e) => {
            if (calOpen || e.key !== "Enter") return;
            const next = (e.currentTarget as HTMLInputElement).value;
            if (next) onChange(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && calOpen) {
              e.preventDefault();
              setCalOpen(false);
              return;
            }
            /* Native Safari/Chrome date pickers commit with Space then Enter.
               Never steal those keys unless OUR overlay calendar is open. */
            if (!calOpen) return;
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              moveCursor(-1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              moveCursor(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveCursor(-7);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              moveCursor(7);
            } else if (e.key === "Enter" || e.key === " " || e.code === "Space") {
              e.preventDefault();
              e.stopPropagation();
              commit(cursor);
            }
          }}
          aria-label="Validity date"
          aria-expanded={calOpen}
          aria-haspopup="dialog"
        />
        <button
          type="button"
          data-testid="validity-cal-toggle"
          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-[11px] font-semibold text-[var(--color-atlas-navy)] hover:bg-[var(--color-atlas-gold-soft)]"
          onClick={openChooser}
          aria-label="Open date picker"
        >
          Calendar
        </button>
        <Input
          id={textInputId}
          className="mt-0 min-w-[8rem] flex-1"
          value={dateVal ? "" : value}
          placeholder="or 15 days"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onTextKeyDown}
          aria-label="Validity text"
        />
      </div>
      {calOpen ? (
        <div
          ref={calRef}
          data-testid="validity-calendar"
          role="dialog"
          aria-label="Choose validity date"
          className={cn(
            "absolute z-30 w-[17.5rem] rounded-lg border border-[var(--color-border)] bg-white p-2 shadow-lg",
            calUp ? "bottom-full mb-1" : "mt-1",
          )}
        >
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--color-atlas-navy)]">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-slate-100"
              onClick={() =>
                setCursor(toIso(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1)))
              }
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
              const selected = cell.iso === cursor;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  data-iso={cell.iso}
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
          <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
            Space / arrows / Enter select the highlighted day. Enter also confirms the browser date picker.
          </p>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-md border border-[var(--color-border)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--color-atlas-navy)] hover:bg-[var(--color-atlas-gold-soft)]"
            onClick={() => onChange(addDays(p.days))}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded-md border border-[var(--color-border)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-slate-50"
          onClick={() => onChange("15 days")}
        >
          15 days
        </button>
      </div>
    </div>
  );
}
