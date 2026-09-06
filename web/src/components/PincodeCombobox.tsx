"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import { searchPincodes, type PincodeHit } from "@/lib/locations/pincode-search";

/** India PIN / place combobox (legacy pincode directory). */
export function PincodeCombobox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<PincodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchPincodes(q, 12)
        .then((rows) => {
          setHits(rows);
          setErr(null);
        })
        .catch(() => setErr("PIN directory unavailable"));
    }, 150);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(hit: PincodeHit) {
    onChange(hit.label);
    setQ(hit.label);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <Label>{label}</Label>
      <Input
        value={q}
        placeholder={placeholder || "PIN or city (e.g. 560001, Mumbai)"}
        autoComplete="off"
        aria-controls={listId}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {err ? <p className="mt-1 text-[11px] text-amber-700">{err}</p> : null}
      {open && hits.length > 0 ? (
        <ul
          id={listId}
          className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg"
        >
          {hits.map((h) => (
            <li key={h.pin + h.label}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-sky-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
              >
                <span className="font-bold text-[var(--color-atlas-navy)]">{h.pin}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {h.place || h.label}
                  {h.district ? ` · ${h.district}` : ""}
                  {h.state ? `, ${h.state}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
