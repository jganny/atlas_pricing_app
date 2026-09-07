"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import {
  searchCarriers,
  type CarrierKind,
  type CarrierRecord,
} from "@/lib/carriers/directory";

const COLOADERS: CarrierRecord[] = [
  { code: "VANGUARD", name: "Vanguard Logistics", kind: "ocean", country: "IN" },
  { code: "ECU", name: "ECU Worldwide", kind: "ocean", country: "BE" },
  { code: "SCAN", name: "Scan-Shipping / Scan Global", kind: "ocean" },
  { code: "CONCOR", name: "CONCOR", kind: "ocean", country: "IN" },
  { code: "ALLCARGO", name: "Allcargo Logistics", kind: "ocean", country: "IN" },
  { code: "TEAMGLOBAL", name: "Team Global Logistics", kind: "ocean", country: "IN" },
  { code: "CW", name: "Continental Worldwide", kind: "ocean" },
  { code: "SHIPCO", name: "Shipco Transport", kind: "ocean" },
  { code: "VANGUARDNVOCC", name: "Vanguard NVOCC", kind: "ocean" },
];

export function CarrierCombobox({
  label,
  value,
  onChange,
  kind,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  kind: CarrierKind | "all" | "ocean+coloader";
  placeholder?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<CarrierRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const searchKind: CarrierKind | "all" =
    kind === "ocean+coloader" ? "ocean" : kind === "all" ? "all" : kind;

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        const rows = await searchCarriers(q, searchKind, 36);
        let merged = rows;
        if (kind === "ocean+coloader") {
          const qq = q.trim().toLowerCase();
          const extras = COLOADERS.filter(
            (c) =>
              !qq ||
              c.code.toLowerCase().includes(qq) ||
              c.name.toLowerCase().includes(qq),
          );
          const seen = new Set(merged.map((c) => c.code.toUpperCase()));
          for (const c of extras) {
            if (!seen.has(c.code.toUpperCase())) merged.push(c);
          }
        }
        setHits(merged.slice(0, 40));
        setActive(0);
      })();
    }, 100);
    return () => window.clearTimeout(t);
  }, [q, searchKind, kind]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(hit: CarrierRecord) {
    const next = `${hit.code} — ${hit.name}`;
    onChange(next);
    setQ(next);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
        value={q}
        placeholder={placeholder || "Type code or name…"}
        autoComplete="off"
        name="atlas-carrier"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        role="combobox"
        onFocus={() => setOpen(true)}
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
            <li key={`${h.kind}-${h.code}-${h.name}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`flex w-full flex-col px-3 py-1.5 text-left text-sm ${
                  i === active ? "bg-sky-100" : "hover:bg-sky-50"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
              >
                <span className="font-bold text-[var(--color-atlas-navy)]">
                  {h.code}{" "}
                  <span className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                    {h.kind}
                  </span>
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
