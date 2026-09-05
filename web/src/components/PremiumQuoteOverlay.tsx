"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Leaf,
  Plane,
  Search,
  Ship,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { searchLocations, type LocationHit } from "@/lib/locations/search";
import {
  RATE_PROVIDER_SLOTS,
  searchRateCards,
  type RateQuoteCard,
  type TransportMode,
} from "@/lib/rates/aggregator";

type Step = 1 | 2 | 3;

function LocationField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string;
  value: string;
  onChange: (code: string, hit?: LocationHit) => void;
  kind: "airport" | "seaport" | "all";
}) {
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<LocationHit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void searchLocations(q, kind, 8).then((rows) => {
        if (!cancelled) setHits(rows);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, kind]);

  return (
    <div className="relative">
      <Label>{label}</Label>
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={kind === "seaport" ? "INNSA / Hamburg" : "BLR / LHR"}
        autoComplete="off"
      />
      {open && hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-white shadow-lg">
          {hits.map((h) => (
            <li key={`${h.kind}-${h.code}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-sky-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQ(h.code);
                  onChange(h.code, h);
                  setOpen(false);
                }}
              >
                <span className="font-bold text-[var(--color-atlas-navy)]">
                  {h.code}{" "}
                  <span className="font-medium text-[var(--color-text-muted)]">· {h.name}</span>
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {[h.city, h.country].filter(Boolean).join(", ")} · {h.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PremiumQuoteOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<TransportMode>("air");
  const [origin, setOrigin] = useState("BLR");
  const [destination, setDestination] = useState("LHR");
  const [weightKg, setWeightKg] = useState("250");
  const [volumeCbm, setVolumeCbm] = useState("1.2");
  const [containers, setContainers] = useState("1");
  const [insurance, setInsurance] = useState(false);
  const [customs, setCustoms] = useState(false);
  const [dangerous, setDangerous] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [results, setResults] = useState<RateQuoteCard[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const locKind = mode === "sea" ? "seaport" : mode === "air" ? "airport" : "all";
  const progress = step / 3;
  const selectedCard = useMemo(
    () => results.find((r) => r.id === selected) || null,
    [results, selected],
  );

  function runSearch() {
    const cards = searchRateCards({
      mode,
      origin,
      destination,
      weightKg: Number(weightKg) || undefined,
      volumeCbm: Number(volumeCbm) || undefined,
      containers: mode === "sea" || mode === "all" ? Number(containers) || 1 : undefined,
      insurance,
      customs,
      dangerous,
      localChargesOnly: localOnly,
    });
    setResults(cards);
    setSelected(cards[0]?.id ?? null);
    setStep(3);
    toast(
      cards.length
        ? `${cards.length} options · open estimates + carrier directory`
        : "Enter origin and destination to search",
      cards.length ? "success" : "error",
    );
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="atlas-overlay absolute inset-0"
        aria-label="Close quote overlay"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="atlas-glass relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Request a quote"
        data-testid="quote-overlay"
      >
        <div className="bg-[var(--color-atlas-navy)] px-4 py-3 text-white sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200/90">
                Atlas quote desk
              </div>
              <div className="text-lg font-extrabold tracking-tight">Request a quote</div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-white/10"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-white/70">
              <span>
                {step}/3{" "}
                {step === 1 ? "Mode & lane" : step === 2 ? "Cargo & options" : "Results"}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-teal-400 transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                Pick a mode, then origin and destination — autocomplete uses the free global
                airport & UN/LOCODE directory.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["air", "Air", Plane],
                    ["sea", "Sea", Ship],
                    ["road", "Road", Truck],
                    ["all", "All modes", Layers],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-bold transition",
                      mode === id
                        ? "border-teal-500 bg-teal-50 text-[var(--color-atlas-navy)]"
                        : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-sky-300",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <LocationField
                  label="Origin"
                  value={origin}
                  kind={locKind}
                  onChange={(code) => setOrigin(code)}
                />
                <LocationField
                  label="Destination"
                  value={destination}
                  kind={locKind}
                  onChange={(code) => setDestination(code)}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Chargeable weight (kg)</Label>
                  <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
                <div>
                  <Label>Volume (CBM)</Label>
                  <Input value={volumeCbm} onChange={(e) => setVolumeCbm(e.target.value)} />
                </div>
                {mode === "sea" || mode === "all" ? (
                  <div>
                    <Label>Containers (TEU)</Label>
                    <Input value={containers} onChange={(e) => setContainers(e.target.value)} />
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                <div className="border-b border-[var(--color-border)] px-4 py-2.5 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--color-atlas-navy)]">
                  Customs & insurance
                </div>
                {(
                  [
                    ["Insurance", insurance, setInsurance, false],
                    ["I need customs clearance", customs, setCustoms, false],
                    ["My shipment is dangerous", dangerous, setDangerous, true],
                    ["Only local charges", localOnly, setLocalOnly, false],
                  ] as const
                ).map(([label, on, set, warn]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-atlas-navy)]">
                      {warn ? <span className="text-rose-600">▲</span> : null}
                      {label}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => set(!on)}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition",
                        on ? "bg-teal-500" : "bg-slate-300",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                          on ? "left-5" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">
                    Product options
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {origin} → {destination} · sorted by estimated total
                  </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={runSearch}>
                  <Search className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              {results.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                  No options yet — go back and search.
                </div>
              ) : (
                <ul className="space-y-3">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(r.id)}
                        className={cn(
                          "w-full rounded-xl border bg-white p-4 text-left transition",
                          selected === r.id
                            ? "border-teal-500 ring-2 ring-teal-200"
                            : "border-[var(--color-border)] hover:border-sky-300",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--color-atlas-navy)]">
                              {r.mode === "air" ? (
                                <Plane className="h-4 w-4" />
                              ) : r.mode === "sea" ? (
                                <Ship className="h-4 w-4" />
                              ) : (
                                <Truck className="h-4 w-4" />
                              )}
                              {r.carrierName}
                            </div>
                            <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                              {r.service} · {r.carrierCode}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                              {r.currency === "USD" ? "$" : "₹"}
                              {r.total.toLocaleString()}
                            </div>
                            {r.perUnit != null ? (
                              <div className="text-[11px] text-[var(--color-text-muted)]">
                                {r.perUnit} {r.unitLabel}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                              Transit
                            </div>
                            <div className="font-bold">
                              <Clock className="mr-1 inline h-3 w-3" />
                              {r.transitDays}d
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                              CO₂e
                            </div>
                            <div className="font-bold">
                              <Leaf className="mr-1 inline h-3 w-3" />
                              {r.co2eTons ?? "—"} t
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                              Source
                            </div>
                            <div className="font-bold capitalize">{r.source}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <details className="rounded-lg border border-[var(--color-border)] bg-slate-50 px-3 py-2 text-xs text-[var(--color-text-muted)]">
                <summary className="cursor-pointer font-bold text-[var(--color-atlas-navy)]">
                  Rate providers (free + ready slots)
                </summary>
                <ul className="mt-2 space-y-1">
                  {RATE_PROVIDER_SLOTS.map((p) => (
                    <li key={p.id}>
                      <span className="font-semibold">{p.name}</span> — {p.note}{" "}
                      <span className="uppercase text-[10px]">({p.status})</span>
                    </li>
                  ))}
                </ul>
                {selectedCard ? (
                  <p className="mt-2 border-t border-[var(--color-border)] pt-2">
                    {selectedCard.sourceNote}
                  </p>
                ) : null}
              </details>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] bg-white/90 px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 1}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap gap-2">
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1) {
                    if (!origin.trim() || !destination.trim()) {
                      toast("Origin and destination required", "error");
                      return;
                    }
                    setStep(2);
                    return;
                  }
                  runSearch();
                }}
              >
                {step === 2 ? (
                  <>
                    <Search className="h-4 w-4" />
                    Search rates
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <>
                <Link
                  href={
                    selectedCard?.mode === "sea"
                      ? "/sea"
                      : selectedCard?.mode === "air"
                        ? "/air"
                        : "/smart-quote/air"
                  }
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14154a]"
                >
                  <Sparkles className="h-4 w-4" />
                  Open on desk
                </Link>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function QuoteOverlayToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="quote-open"
      className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700"
      title="Request a quote"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">New quote</span>
    </button>
  );
}
