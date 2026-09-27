"use client";

/** One bordered "Min – Max" field for a numeric range filter, instead of
 * two loose, disconnected number boxes — the shape used for numeric ranges
 * in Salesforce Lightning list filters and price-range fields (Google
 * Flights and similar). Reads as one filter, not two. */
export function RangeNumberField({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minAriaLabel,
  maxAriaLabel,
  unit,
}: {
  label?: string;
  minValue: string;
  maxValue: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  minAriaLabel?: string;
  maxAriaLabel?: string;
  unit?: string;
}) {
  return (
    <div>
      {label ? (
        <span className="mb-1 block text-[11px] font-semibold text-[var(--color-text-muted)]">{label}</span>
      ) : null}
      <div className="flex items-center rounded-md border border-[var(--color-border)] bg-white focus-within:border-[var(--color-atlas-gold)]">
        <input
          type="number"
          aria-label={minAriaLabel ?? "Minimum"}
          placeholder="Min"
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          className="w-0 flex-1 rounded-l-md border-0 bg-transparent px-2 py-1.5 text-right text-sm text-[var(--color-text)] outline-none"
        />
        <span className="px-1.5 text-sm text-[var(--color-text-muted)]">–</span>
        <input
          type="number"
          aria-label={maxAriaLabel ?? "Maximum"}
          placeholder="Max"
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          className="w-0 flex-1 rounded-r-md border-0 bg-transparent px-2 py-1.5 text-sm text-[var(--color-text)] outline-none"
        />
        {unit ? (
          <span className="whitespace-nowrap border-l border-[var(--color-border)] px-2 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}
