"use client";

import type { VendorPreviewRow } from "@/lib/quotes/vendor-preview";
import { formatCurrency, cn } from "@/lib/utils";

export function VendorCompareList({
  vendors,
  currency,
  heading = "Compare options",
  hint = "Cheapest → highest. ★ marks the lowest total. Quoted is the option on this document.",
  onSelect,
  testId = "vendor-compare-list",
}: {
  vendors: VendorPreviewRow[];
  currency: string;
  heading?: string;
  hint?: string;
  onSelect?: (id: string) => void;
  testId?: string;
}) {
  if (vendors.length === 0) return null;

  return (
    <div data-testid={testId}>
      <h3 className="mb-1 text-sm font-extrabold text-[var(--color-atlas-navy)]">{heading}</h3>
      <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">{hint}</p>
      <ul className="space-y-2 text-sm">
        {vendors.map((v) => {
          const inner = (
            <>
              <span className={cn("min-w-0", v.cheapest || v.selected ? "font-bold" : "")}>
                <span data-testid="vendor-compare-name">{v.name || "Untitled"}</span>
                {v.cheapest ? (
                  <span data-testid="vendor-compare-star" className="text-emerald-700">
                    {" "}
                    ★
                  </span>
                ) : null}
                {v.selected ? (
                  <span className="font-semibold text-sky-800"> · quoted</span>
                ) : (
                  <span className="font-normal text-[var(--color-text-muted)]">
                    {" "}
                    · {v.kindLabel}
                  </span>
                )}
                {v.routing ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-[var(--color-text-muted)]">
                    {v.routing}
                    {v.tt ? ` · ${v.tt}` : ""}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums" data-testid="vendor-compare-total">
                {formatCurrency(v.total, currency)}
              </span>
            </>
          );
          const className = cn(
            "flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left",
            v.cheapest
              ? "bg-emerald-50 ring-1 ring-emerald-300"
              : v.selected
                ? "bg-sky-50"
                : "bg-slate-50",
          );
          return (
            <li key={v.id} data-cheapest={v.cheapest ? "true" : "false"} data-quoted={v.selected ? "true" : "false"}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(v.id)} className={className}>
                  {inner}
                </button>
              ) : (
                <div className={className}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
