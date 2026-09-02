"use client";

import { Card } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeleton";
import { useAirTariffs, useCirculars, useSeaTariffs } from "@/hooks/use-atlas-data";
import { useLiveData } from "@/lib/api";

export default function CircularsPage() {
  const { data: air = [], isLoading: airLoading } = useAirTariffs();
  const { data: sea = [], isLoading: seaLoading } = useSeaTariffs();
  const { data: circulars = [], isLoading: circularsLoading } = useCirculars();

  const loading = airLoading || seaLoading || circularsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Circulars library</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {useLiveData
            ? "Published tariffs and circular documents from Firestore."
            : "Mock air/sea tariffs — upload library comes in a later phase."}
        </p>
      </div>

      {useLiveData && circulars.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-bold">Circular documents</h2>
          <ul className="space-y-2 text-sm">
            {circulars.slice(0, 12).map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="font-semibold">{c.title || c.fileName || "Untitled"}</div>
                <div className="text-[var(--color-text-muted)]">
                  {[c.carrier, c.category].filter(Boolean).join(" · ") || "—"}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Air tariffs</h2>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
            <ul className="space-y-2 text-sm">
              {air.length === 0 ? (
                <li className="text-[var(--color-text-muted)]">No published air tariffs found.</li>
              ) : (
                air.map((t) => (
                  <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="font-semibold">{t.carrier}</div>
                    <div className="text-[var(--color-text-muted)]">
                      {t.origin} → {t.destination} · {t.currency}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Sea tariffs</h2>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
            <ul className="space-y-2 text-sm">
              {sea.length === 0 ? (
                <li className="text-[var(--color-text-muted)]">No published sea tariffs found.</li>
              ) : (
                sea.map((t) => (
                  <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="font-semibold">{t.carrier}</div>
                    <div className="text-[var(--color-text-muted)]">
                      {t.origin} → {t.destination} · {t.mode.toUpperCase()} · {t.currency}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
