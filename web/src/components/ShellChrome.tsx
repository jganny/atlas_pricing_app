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

const FX_FALLBACK = 83.25;

export function OfflineBadge() {
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

export function GlobalRefreshButton() {
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
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--color-atlas-navy)] hover:bg-slate-50 disabled:opacity-60"
      title="Refresh enquiries, inbox, tariffs"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
      Refresh
    </button>
  );
}

async function fetchUsdInr(): Promise<number | null> {
  const endpoints = [
    "https://open.er-api.com/v6/latest/USD",
    "https://api.frankfurter.app/latest?from=USD&to=INR",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { rates?: { INR?: number } };
      const rate = data.rates?.INR;
      if (typeof rate === "number" && rate > 0) return Number(rate.toFixed(2));
    } catch {
      /* try next */
    }
  }
  return null;
}

export function FxConverter() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [usdInr, setUsdInr] = useState(FX_FALLBACK);
  const [amount, setAmount] = useState("100");
  const [fromUsd, setFromUsd] = useState(true);
  const [source, setSource] = useState<"live" | "cached">("cached");

  useEffect(() => setMounted(true), []);

  const loadRate = useCallback(async () => {
    const rate = await fetchUsdInr();
    if (rate) {
      setUsdInr(rate);
      setSource("live");
    } else {
      setSource("cached");
    }
  }, []);

  useEffect(() => {
    void loadRate();
    const t = window.setInterval(() => void loadRate(), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [loadRate]);

  const n = Number(amount) || 0;
  const converted = fromUsd ? n * usdInr : n / usdInr;

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
            <div className="atlas-glass relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                    FX converter
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    {source === "live" ? "Live mid market" : "Cached desk rate"} · USD/INR{" "}
                    {usdInr.toFixed(2)}
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>{fromUsd ? "USD amount" : "INR amount"}</Label>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <button
                  type="button"
                  className="text-xs font-bold text-sky-700 hover:underline"
                  onClick={() => setFromUsd((v) => !v)}
                >
                  Swap direction
                </button>
                <div className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Converts to
                  </div>
                  <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                    {fromUsd ? "₹" : "$"}
                    {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => void loadRate()}
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
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--color-atlas-navy)] hover:bg-slate-50"
        title="Open FX converter"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        USD/INR {usdInr.toFixed(2)}
      </button>
      {modal}
    </>
  );
}
