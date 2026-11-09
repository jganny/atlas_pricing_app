"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadAirlineNames } from "@/lib/carriers/airline-names";
import { daysLeft, PER_KG_BREAKS, ruleFor, validityOf } from "@/lib/carriers/board";
import { fetchAllTariffs } from "@/lib/firebase/carrier-board";
import { cn } from "@/lib/utils";

const PAGE = 100;
const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * The airline tariff sheets as tables, the way a rate shop shows them: pick an airline, narrow by airport, read every route's
 * rate at every weight break. Click a route to see it ranked against the other airlines above.
 */
export function TariffBrowser({ onPick }: { onPick: (from: string, to: string) => void }) {
  const all = useQuery({ queryKey: ["carrier-board", "all"], queryFn: fetchAllTariffs, staleTime: 5 * 60_000 });
  const names = useQuery({ queryKey: ["carrier-board", "names"], queryFn: loadAirlineNames, staleTime: Infinity });
  const [airline, setAirline] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [currency, setCurrency] = useState("");
  const [shown, setShown] = useState(PAGE);
  const today = useMemo(() => new Date(), []);

  const rows = useMemo(() => all.data ?? [], [all.data]);
  const airlines = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.carrierCode, (m.get(r.carrierCode) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency).filter(Boolean))].sort(), [rows]);
  const nameOf = (code: string) => ruleFor(code)?.name || names.data?.[code] || code;
  const f = from.trim().toUpperCase();
  const t = to.trim().toUpperCase();
  const filtered = useMemo(
    () =>
      rows
        .filter((r) => (!airline || r.carrierCode === airline) && (!f || r.origin.startsWith(f)) && (!t || r.destination.startsWith(t)) && (!currency || r.currency === currency))
        .sort((a, b) => a.carrierCode.localeCompare(b.carrierCode) || a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination)),
    [rows, airline, f, t, currency],
  );
  const reset = () => setShown(PAGE);
  const input = "mt-1 block h-9 rounded-lg border border-[var(--color-border-strong)] bg-white px-2.5 text-sm";

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white" aria-label="Airline tariffs" data-testid="tariff-browser">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Airline tariffs</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Every saved route, one row each, with the rate per kg at each weight break. Click a route to rank the airlines for it.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">Airline
            <select value={airline} onChange={(e) => { setAirline(e.target.value); reset(); }} className={input} aria-label="Airline">
              <option value="">All airlines</option>
              {airlines.map(([code, n]) => <option key={code} value={code}>{code} · {nameOf(code)} ({n})</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">From
            <input value={from} onChange={(e) => { setFrom(e.target.value.toUpperCase()); reset(); }} maxLength={3} placeholder="BLR" className={cn(input, "w-20 font-mono uppercase")} aria-label="From airport" />
          </label>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">To
            <input value={to} onChange={(e) => { setTo(e.target.value.toUpperCase()); reset(); }} maxLength={3} placeholder="FRA" className={cn(input, "w-20 font-mono uppercase")} aria-label="To airport" />
          </label>
          {currencies.length > 1 ? (
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Currency
              <select value={currency} onChange={(e) => { setCurrency(e.target.value); reset(); }} className={input} aria-label="Currency">
                <option value="">All</option>
                {currencies.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {all.isLoading ? (
        <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">Loading tariffs…</p>
      ) : !rows.length ? (
        <p className="px-5 py-8 text-sm text-[var(--color-text-muted)]" data-testid="tariff-empty">
          No airline tariffs have been loaded onto the board yet. Until then, the original circulars are in the <Link href="/circulars" className="font-semibold text-[var(--color-atlas-navy)] underline underline-offset-2">Circulars library</Link>.
        </p>
      ) : (
        <>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm tabular-nums">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-text-muted)]">
                  <th className="px-4 py-2 text-left">Airline</th>
                  <th className="px-3 py-2 text-left">Route</th>
                  <th className="px-3 py-2 text-left">Cur</th>
                  <th className="px-3 py-2 text-right">MIN</th>
                  {PER_KG_BREAKS.map((b) => <th key={b.key} className="px-3 py-2 text-right">{b.label}</th>)}
                  <th className="px-4 py-2 text-right">Valid to</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((r) => {
                  const v = validityOf(daysLeft(r.validTo, today));
                  return (
                    <tr key={`${r.carrierCode}${r.origin}${r.destination}${r.currency}`} onClick={() => onPick(r.origin, r.destination)} className="cursor-pointer border-b border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]">
                      <td className="whitespace-nowrap px-4 py-2 font-semibold text-[var(--color-atlas-navy)]">{r.carrierCode}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">{r.origin} → {r.destination}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{r.currency}</td>
                      <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{r.breaks.min ? money(Number(r.breaks.min)) : "—"}</td>
                      {PER_KG_BREAKS.map((b) => <td key={b.key} className="px-3 py-2 text-right">{Number(r.breaks[b.key]) > 0 ? money(Number(r.breaks[b.key])) : "—"}</td>)}
                      <td className={cn("whitespace-nowrap px-4 py-2 text-right text-xs", v === "expired" ? "font-semibold text-red-700" : v === "soon" ? "font-semibold text-amber-700" : "text-[var(--color-text-muted)]")}>{r.validTo || "no date"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-text-muted)]">
            <span>{filtered.length ? `Showing ${Math.min(shown, filtered.length)} of ${filtered.length} routes` : "No route matches these filters."}</span>
            {filtered.length > shown ? <button type="button" onClick={() => setShown((n) => n + PAGE)} className="font-semibold text-[var(--color-atlas-navy)] underline underline-offset-2">Show {Math.min(PAGE, filtered.length - shown)} more</button> : null}
          </div>
        </>
      )}
    </section>
  );
}
