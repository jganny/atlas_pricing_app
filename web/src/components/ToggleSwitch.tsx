"use client";

import { cn } from "@/lib/utils";

/**
 * An iPhone-style sliding switch. `checked` is the right-hand / "on" side.
 * Used on its own (Won), or between two named choices with `leftLabel` and `rightLabel` (factory ↔ CFS).
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  leftLabel,
  rightLabel,
  disabled,
  tone = "green",
  className,
  "data-testid": testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Screen-reader name when there are no visible labels. */
  label?: string;
  leftLabel?: string;
  rightLabel?: string;
  disabled?: boolean;
  tone?: "green" | "blue";
  className?: string;
  "data-testid"?: string;
}) {
  const twoSided = Boolean(leftLabel && rightLabel);
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? (twoSided ? `${leftLabel} or ${rightLabel}` : undefined)}
      disabled={disabled}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative inline-block h-[26px] w-[46px] shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50",
        // Two-sided switches are never "off": both sides are real choices, so both are coloured.
        twoSided || tone === "blue" ? "bg-sky-600" : checked ? "bg-emerald-500" : "bg-slate-300",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute left-0.5 top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-transform", checked && "translate-x-5")}
      />
    </button>
  );
  if (!twoSided) return <span className={cn("inline-flex items-center gap-2", className)}>{track}</span>;
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-sm", className)}>
      <button type="button" disabled={disabled} onClick={() => onChange(false)} className={cn("rounded px-0.5", !checked ? "font-extrabold text-[var(--color-atlas-navy)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-atlas-navy)]")}>
        {leftLabel}
      </button>
      {track}
      <button type="button" disabled={disabled} onClick={() => onChange(true)} className={cn("rounded px-0.5", checked ? "font-extrabold text-[var(--color-atlas-navy)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-atlas-navy)]")}>
        {rightLabel}
      </button>
    </span>
  );
}
