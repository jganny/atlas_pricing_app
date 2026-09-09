"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import { searchHsnCommodities, type HsnItem } from "@/lib/pricing/hsn";
import { closeAllComboboxes, useCloseComboboxes } from "@/lib/ui/close-comboboxes";

export function CommodityCombobox({
  label = "Commodity (HSN)",
  value,
  onChange,
  placeholder = "GENERAL, 2201, perishables…",
  inputId,
  onInputKeyDown,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  inputId?: string;
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const listId = useId();
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<HsnItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useCloseComboboxes(() => setOpen(false));

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setHits(searchHsnCommodities(q, 40));
      setActive(0);
    }, 80);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(item: HsnItem) {
    onChange(item.label);
    setQ(item.label);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
      if (hit) pick(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Label>{label}</Label>
      <Input
        id={inputId}
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        name="atlas-commodity"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        role="combobox"
        onFocus={() => {
          closeAllComboboxes();
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && hits.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg"
        >
          {hits.map((h, i) => (
            <li key={`${h.code}-${h.name}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`flex w-full flex-col px-3 py-1.5 text-left text-sm ${
                  i === active ? "bg-sky-100" : "hover:bg-sky-50"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
              >
                <span className="font-bold text-[var(--color-atlas-navy)]">{h.code}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
