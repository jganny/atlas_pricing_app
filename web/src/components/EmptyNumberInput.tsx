"use client";

import { cn } from "@/lib/utils";

/**
 * Number field that stays blank at 0 so a leading zero cannot stick when typing.
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
      value={value === 0 ? "" : String(value)}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === "") {
          onChange(0);
          return;
        }
        if (!/^-?\d*[.]?\d*$/.test(raw)) return;
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
