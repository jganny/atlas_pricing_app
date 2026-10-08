"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * What the box shows: the text being typed while it still means the same number
 * (so "7." and "0.0" survive on the way to "7.5" / "0.05"), otherwise the number
 * itself — blank at 0 so a leading zero cannot stick.
 */
export function emptyNumberDisplay(draft: string | null, value: number): string {
  if (draft !== null && (draft.trim() === "" ? 0 : Number(draft)) === value) return draft;
  return value === 0 ? "" : String(value);
}

/** Only digits with at most one decimal point (and an optional leading minus) are accepted. */
export function isNumberDraft(raw: string): boolean {
  return /^-?\d*[.]?\d*$/.test(raw);
}

/**
 * Number field that stays blank at 0 so a leading zero cannot stick when typing,
 * and keeps what is being typed as text so decimals can be entered.
 */
export function EmptyNumberInput({
  id,
  value,
  onChange,
  className,
  placeholder,
  disabled,
  step,
  onKeyDown,
}: {
  id?: string;
  value: number;
  onChange: (next: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  step?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      step={step}
      className={cn("rounded-lg border border-[var(--color-border)] px-3 py-2", className)}
      value={emptyNumberDisplay(draft, value)}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") {
          setDraft(null);
          onChange(0);
          return;
        }
        if (!isNumberDraft(raw)) return;
        setDraft(raw);
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={onKeyDown}
    />
  );
}
