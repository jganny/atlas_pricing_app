"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { toast } from "@/components/Toast";
import { queryKeys } from "@/hooks/query-keys";
import { cn } from "@/lib/utils";

type FxPair = "USD" | "EUR" | "GBP";

const FX_FALLBACK: Record<FxPair, number> = {
  USD: 83.25,
  EUR: 90.5,
  GBP: 105.2,
};

const PAIRS: FxPair[] = ["USD", "EUR", "GBP"];

export function OfflineBadge({ compact = false }: { compact?: boolean }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide",
          online ? "text-emerald-800" : "text-amber-800",
        )}
        title={online ? "Connected" : "Offline"}
      >
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {online ? "Live" : "Off"}
      </span>
    );
  }
  return online ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
      <Wifi className="h-3 w-3" /> Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
      <WifiOff className="h-3 w-3" /> Offline
    </span>
  );
}

export function GlobalRefreshButton({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function refreshAll() {
    setBusy(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.enquiries }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inbox }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leads }),
        queryClient.invalidateQueries({ queryKey: queryKeys.circulars }),
        queryClient.invalidateQueries({ queryKey: queryKeys.directory }),
        queryClient.invalidateQueries({ queryKey: queryKeys.airTariffs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.seaTariffs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.courierTariffs }),
      ]);
      window.dispatchEvent(new CustomEvent("atlas:refresh"));
      toast("Workspace data refreshed", "success");
    } catch {
      toast("Refresh failed — try again", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void refreshAll()}
      disabled={busy}
      data-testid="global-refresh"
      className={
        compact
          ? "inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-atlas-navy)] hover:bg-white disabled:opacity-60"
          : "inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--color-atlas-navy)] hover:bg-slate-50 disabled:opacity-60"
      }
      title="Refresh enquiries, inbox, tariffs"
      aria-label="Refresh"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
      {compact ? null : "Refresh"}
    </button>
  );
}

async function fetchPairToInr(from: FxPair): Promise<number | null> {
  const endpoints = [
    `https://open.er-api.com/v6/latest/${from}`,
    `https://api.frankfurter.app/latest?from=${from}&to=INR`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { rates?: { INR?: number } };
      const rate = data.rates?.INR;
      if (typeof rate === "number" && rate > 0) return Number(rate.toFixed(4));
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchAllFx(): Promise<Partial<Record<FxPair, number>>> {
  const entries = await Promise.all(
    PAIRS.map(async (pair) => {
      const rate = await fetchPairToInr(pair);
      return [pair, rate] as const;
    }),
  );
  const out: Partial<Record<FxPair, number>> = {};
  for (const [pair, rate] of entries) {
    if (rate) out[pair] = rate;
  }
  return out;
}

export function FxConverter({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rates, setRates] = useState<Record<FxPair, number>>({ ...FX_FALLBACK });
  const [pair, setPair] = useState<FxPair>("USD");
  const [amount, setAmount] = useState("1");
  const [fromForeign, setFromForeign] = useState(true);
  const [source, setSource] = useState<"live" | "cached">("cached");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const loadRates = useCallback(async () => {
    const live = await fetchAllFx();
    if (Object.keys(live).length === 0) {
      setSource("cached");
      return;
    }
    setRates((prev) => ({
      USD: live.USD ?? prev.USD,
      EUR: live.EUR ?? prev.EUR,
      GBP: live.GBP ?? prev.GBP,
    }));
    setSource("live");
    setUpdatedAt(new Date().toISOString().slice(0, 19));
  }, []);

  useEffect(() => {
    void loadRates();
    const t = window.setInterval(() => void loadRates(), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [loadRates]);

  const rate = rates[pair];
  const n = Number(amount) || 0;
  const converted = fromForeign ? n * rate : n / rate;
  const leftCode = fromForeign ? pair : "INR";
  const rightCode = fromForeign ? "INR" : pair;
  const leftValue = fromForeign ? n : converted;
  const rightValue = fromForeign ? converted : n;

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            data-testid="fx-modal"
          >
            <button
              type="button"
              className="atlas-overlay absolute inset-0"
              aria-label="Close FX"
              onClick={() => setOpen(false)}
            />
            <div className="atlas-glass relative z-10 w-full max-w-md rounded-2xl p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                    Exchange rate
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    {source === "live" ? "Live mid-market" : "Cached desk rate"} · USD · EUR · GBP →
                    INR
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                {PAIRS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPair(p)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-bold",
                      pair === p
                        ? "bg-white text-[var(--color-atlas-navy)] shadow-sm"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-atlas-navy)]",
                    )}
                  >
                    {p}/INR {rates[p].toFixed(2)}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Amount ({leftCode})</Label>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="text-lg font-extrabold tabular-nums"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {leftCode}
                    </div>
                    <div className="mt-0.5 text-xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                      {leftValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Swap currencies"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-atlas-gold)] text-[var(--color-atlas-ink)] shadow hover:bg-[var(--color-atlas-gold-bright)]"
                    onClick={() => {
                      setAmount(String(Number(converted.toFixed(6))));
                      setFromForeign((v) => !v);
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-white px-3 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {rightCode}
                    </div>
                    <div className="mt-0.5 text-xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                      {rightValue.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] italic text-[var(--color-text-muted)]">
                  Last update: {updatedAt ?? "using cached mid-market"}
                </p>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => void loadRates()}
                  >
                    Refresh rate
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => setOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="fx-open"
        className={
          compact
            ? "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold tabular-nums text-[var(--color-atlas-navy)] hover:bg-white"
            : "inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--color-atlas-navy)] hover:bg-slate-50"
        }
        title="Open FX converter (USD / EUR / GBP → INR)"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {compact ? (
          <span>USD {rates.USD.toFixed(2)}</span>
        ) : (
          <>
            <span className="hidden lg:inline">
              USD {rates.USD.toFixed(2)} · EUR {rates.EUR.toFixed(2)} · GBP {rates.GBP.toFixed(2)}
            </span>
            <span className="lg:hidden">
              {pair}/INR {rate.toFixed(2)}
            </span>
          </>
        )}
      </button>
      {modal}
    </>
  );
}
