"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import { searchLocations, type LocationHit } from "@/lib/locations/search";

type Kind = "airport" | "seaport" | "all";

export function LocationCombobox({
  label,
  value,
  onChange,
  kind,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  kind: Kind;
  placeholder?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<LocationHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchLocations(q, kind, 10).then(setHits);
    }, 120);
    return () => window.clearTimeout(t);
  }, [q, kind]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(hit: LocationHit) {
    const next = `${hit.code} — ${hit.name}${hit.city ? `, ${hit.city}` : ""}`;
    onChange(hit.code);
    setQ(next);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <Label>{label}</Label>
      <Input
        value={q}
        placeholder={placeholder || (kind === "seaport" ? "INNSA, NLRTM…" : "BLR, LHR…")}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && hits.length > 0 ? (
        <ul
          id={listId}
          className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg"
        >
          {hits.map((h) => (
            <li key={`${h.kind}-${h.code}`}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-sky-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
              >
                <span className="font-bold text-[var(--color-atlas-navy)]">
                  {h.code}{" "}
                  <span className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                    {h.kind}
                  </span>
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {h.name}
                  {h.city ? ` · ${h.city}` : ""}
                  {h.country ? ` · ${h.country}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
