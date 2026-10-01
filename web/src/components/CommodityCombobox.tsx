"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import { PortalDropdown } from "@/components/PortalDropdown";
import { searchHsnCommodities, type HsnItem } from "@/lib/pricing/hsn";
import { closeAllComboboxes, useCloseComboboxes } from "@/lib/ui/close-comboboxes";
import { useComboboxKeyNav } from "@/hooks/use-combobox-key-nav";

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
  const inputWrapRef = useRef<HTMLDivElement>(null);

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
      const node = e.target as Node | null;
      if (boxRef.current?.contains(node)) return;
      if (node instanceof Element && node.closest("[data-portal-dropdown]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(item: HsnItem) {
    onChange(item.label);
    setQ(item.label);
    setOpen(false);
  }

  const onKeyDown = useComboboxKeyNav({
    hits,
    open,
    setOpen,
    active,
    setActive,
    onPick: pick,
    onInputKeyDown,
  });

  return (
    <div ref={boxRef} className="relative">
      <Label>{label}</Label>
      <div ref={inputWrapRef}>
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
      </div>
      <PortalDropdown open={open && hits.length > 0} anchorRef={inputWrapRef}>
        <ul id={listId} role="listbox" data-portal-open={open ? "true" : "false"}>
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
      </PortalDropdown>
    </div>
  );
}
