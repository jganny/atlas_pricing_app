"use client";

import { useMemo, useState } from "react";
import type { CourierTariffBook, CourierTariffDirection } from "@/lib/quotes/courier-tariff";
import { pickTariffSlab } from "@/lib/quotes/courier-tariff";
import { formatCurrency } from "@/lib/utils";

const TABS: Array<{ id: CourierTariffDirection | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "export", label: "Export" },
  { id: "import", label: "Import" },
  { id: "domestic", label: "Domestic" },
];

export function CourierTariffBoard({
  book,
  previewKg,
}: {
  book: CourierTariffBook;
  previewKg?: number;
}) {
  const [tab, setTab] = useState<CourierTariffDirection | "all">("all");
  const [q, setQ] = useState("");
  const kg = previewKg && previewKg > 0 ? previewKg : 0;

  const lanes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return book.lanes.filter((l) => {
      if (tab !== "all" && l.direction !== tab) return false;
      if (!needle) return true;
      return `${l.destination} ${l.destinationLabel} ${l.origin} ${l.direction}`
        .toLowerCase()
        .includes(needle);
    });
  }, [book.lanes, q, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: book.lanes.length, export: 0, import: 0, domestic: 0 };
    for (const l of book.lanes) c[l.direction] += 1;
    return c;
  }, [book.lanes]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 bg-[var(--color-atlas-navy)] px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
            Courier tariff
          </p>
          <h2 className="text-xl font-extrabold">
            {book.carrier} · {book.year}
          </h2>
          <p className="mt-1 text-xs text-sky-100">
            Valid {book.validFrom.slice(0, 10)} → {book.validTo.slice(0, 10)} · up to {book.maxKg}{" "}
            kg · {book.currency}
          </p>
        </div>
        <p className="text-xs text-sky-100">
          {book.lanes.length} lanes · above {book.maxKg} kg is case-by-case
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        {TABS.map((t) =>
          t.id !== "all" && !counts[t.id] ? null : (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                tab === t.id
                  ? "bg-[var(--color-atlas-navy)] text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {t.label} ({counts[t.id] ?? 0})
            </button>
          ),
        )}
        <input
          className="ml-auto min-w-[180px] flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm"
          placeholder="Find a country…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2">Lane</th>
              <th className="px-5 py-2">Direction</th>
              <th className="px-5 py-2">Slabs</th>
              <th className="px-5 py-2 text-right">{kg ? `${kg} kg` : "Rate"}</th>
            </tr>
          </thead>
          <tbody>
            {lanes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  No lanes in this view.
                </td>
              </tr>
            ) : (
              lanes.map((lane) => {
                const slab = kg ? pickTariffSlab(lane.breaks, kg) : lane.breaks[0];
                return (
                  <tr
                    key={`${lane.direction}-${lane.origin}-${lane.destination}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-5 py-2.5">
                      <div className="font-semibold text-[var(--color-atlas-navy)]">
                        {lane.destinationLabel || lane.destination}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {lane.origin} → {lane.destination}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 capitalize text-slate-600">{lane.direction}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">
                      {lane.breaks.length} wts · max {lane.breaks[lane.breaks.length - 1]?.kg} kg
                    </td>
                    <td className="px-5 py-2.5 text-right font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                      {slab
                        ? `${formatCurrency(slab.rate, book.currency)}${kg ? ` · ${slab.kg} kg` : ""}`
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
