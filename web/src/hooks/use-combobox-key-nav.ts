"use client";

import type { KeyboardEvent } from "react";

/**
 * Shared arrow/enter/escape navigation for a search-as-you-type combobox —
 * previously reimplemented near-identically in CarrierCombobox,
 * CommodityCombobox, LocationCombobox and PincodeCombobox.
 */
export function useComboboxKeyNav<T>({
  hits,
  open,
  setOpen,
  active,
  setActive,
  onPick,
  onInputKeyDown,
}: {
  hits: T[];
  open: boolean;
  setOpen: (open: boolean) => void;
  active: number;
  setActive: (updater: number | ((i: number) => number)) => void;
  onPick: (hit: T) => void;
  onInputKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    onInputKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp") && hits.length > 0) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) onPick(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
}
