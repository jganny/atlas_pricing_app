"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { mockApi } from "@/lib/mock/api";
import type { AirTariff, SeaTariff } from "@/lib/types";

export default function CircularsPage() {
  const [air, setAir] = useState<AirTariff[]>([]);
  const [sea, setSea] = useState<SeaTariff[]>([]);

  useEffect(() => {
    mockApi.fetchAirTariffs().then(setAir);
    mockApi.fetchSeaTariffs().then(setSea);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Circulars library</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Published tariffs from mock Circulars — mirrors air_tariffs and sea_tariffs collections.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Air tariffs</h2>
          <ul className="space-y-2 text-sm">
            {air.map((t) => (
              <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="font-semibold">{t.carrier}</div>
                <div className="text-[var(--color-text-muted)]">
                  {t.origin} → {t.destination} · {t.currency}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Sea tariffs</h2>
          <ul className="space-y-2 text-sm">
            {sea.map((t) => (
              <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="font-semibold">{t.carrier}</div>
                <div className="text-[var(--color-text-muted)]">
                  {t.origin} → {t.destination} · {t.mode.toUpperCase()} · {t.currency}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
