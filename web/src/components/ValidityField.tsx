"use client";

import type { KeyboardEventHandler } from "react";
import { Input, Label } from "@/components/ui";

const PRESETS = [
  { label: "+7d", days: 7 },
  { label: "+15d", days: 15 },
  { label: "+30d", days: 30 },
] as const;

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function asDateValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return "";
}

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

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          className="mt-0 max-w-[11rem]"
          value={dateVal}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              const el = e.currentTarget;
              if (el.value) onChange(el.value);
              el.blur();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              const el = e.currentTarget;
              if (el.value) onChange(el.value);
              el.blur();
            }
          }}
          aria-label="Validity date"
        />
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
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-md border border-[var(--color-border)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--color-atlas-navy)] hover:bg-sky-50"
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
