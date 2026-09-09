"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input, Label } from "@/components/ui";
import { PortalDropdown } from "@/components/PortalDropdown";
import { searchPostalCodes, type PostalHit } from "@/lib/locations/postal-search";

/**
 * Global postal / ZIP / PIN combobox.
 * India PIN directory + worldwide samples; free-text always accepted.
 */
export function PincodeCombobox({
  label,
  value,
  onChange,
  onPick,
  placeholder,
  inputId,
  onInputKeyDown,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onPick?: (hit: PostalHit) => void;
  placeholder?: string;
  inputId?: string;
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const listId = useId();
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<PostalHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void searchPostalCodes(q, 14)
        .then((rows) => {
          setHits(rows);
          setActive(0);
          setErr(null);
        })
        .catch(() => setErr("Postal directory unavailable — type freely"));
    }, 150);
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

  function pick(hit: PostalHit) {
    if (onPick) onPick(hit);
    else onChange(hit.label);
    setQ(onPick ? hit.pin : hit.label);
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
      <div ref={inputWrapRef}>
        <Input
          id={inputId}
          value={q}
          placeholder={placeholder || "ZIP / PIN / city (global)"}
          autoComplete="off"
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setQ(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
        />
      </div>
      {err ? <p className="mt-1 text-[11px] text-amber-700">{err}</p> : null}
      <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
        India PINs + world ZIPs · ↓↑ to select · type any postal code freely
      </p>
      <PortalDropdown open={open && hits.length > 0} anchorRef={inputWrapRef}>
        <ul id={listId} role="listbox" data-portal-open={open ? "true" : "false"}>
          {hits.map((h, i) => (
            <li key={h.pin + h.label + (h.country || "")} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`flex w-full flex-col px-3 py-1.5 text-left text-sm ${
                  i === active ? "bg-sky-100" : "hover:bg-sky-50"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
              >
                <span className="font-bold text-[var(--color-atlas-navy)]">
                  {h.pin}
                  {h.country ? (
                    <span className="ml-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                      {h.country}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {h.place || h.label}
                  {h.district ? ` · ${h.district}` : ""}
                  {h.state ? `, ${h.state}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PortalDropdown>
    </div>
  );
}
