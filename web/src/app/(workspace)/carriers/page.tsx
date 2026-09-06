"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Plane, Search, Ship, Truck } from "lucide-react";
import { Badge, Card, Input } from "@/components/ui";
import {
  CURATED_CARRIERS,
  FREE_DATA_SOURCES,
  searchCarriers,
  type CarrierKind,
  type CarrierRecord,
} from "@/lib/carriers/directory";

const FILTERS: Array<{ id: CarrierKind | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "airline", label: "Airlines" },
  { id: "ocean", label: "Ocean" },
  { id: "courier", label: "Courier" },
];

function KindIcon({ kind }: { kind: CarrierKind }) {
  if (kind === "airline") return <Plane className="h-3.5 w-3.5" />;
  if (kind === "ocean") return <Ship className="h-3.5 w-3.5" />;
  return <Truck className="h-3.5 w-3.5" />;
}

export default function CarriersPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<CarrierKind | "all">("all");
  const [rows, setRows] = useState<CarrierRecord[]>(CURATED_CARRIERS);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void searchCarriers(q, kind, 60).then((hits) => {
        if (!cancelled) setRows(hits);
      });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, kind]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Free global directory
        </p>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
          Airlines & shipping lines
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
          Public directory for search, tracking, and website shortcuts — not a rate shop. Cards
          without Track/Site simply lack a known public URL; they do not hide live pricing. Sell
          rates stay in Circulars / Air·Sea desks. Do not paste carrier portal passwords here —
          official APIs or Circulars uploads are the supported path.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setKind(f.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              kind === f.id
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "border border-[var(--color-border)] bg-white text-[var(--color-atlas-navy)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <Input
          className="pl-9"
          placeholder="Search EK, Maersk, DHL…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <Card key={`${c.kind}-${c.code}`} className="flex flex-col gap-2 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                  {c.code}{" "}
                  <span className="font-semibold text-[var(--color-text-muted)]">· {c.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                  <KindIcon kind={c.kind} />
                  {c.kind}
                  {c.country ? ` · ${c.country}` : ""}
                </div>
              </div>
              <Badge tone="neutral">{c.kind}</Badge>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 text-xs font-semibold">
              {c.trackingUrl ? (
                <a
                  href={c.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-800 hover:underline"
                >
                  Track <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {c.website ? (
                <a
                  href={c.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                >
                  Site <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {!c.trackingUrl && !c.website ? (
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                  No public track/site link yet — use Circulars for rates
                </span>
              ) : null}
            </div>
          </Card>
        ))}
        {rows.length === 0 ? (
          <Card className="col-span-full py-8 text-center text-sm text-[var(--color-text-muted)]">
            No carriers match that search.
          </Card>
        ) : null}
      </div>

      <Card className="py-4">
        <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Free data sources</h2>
        <ul className="mt-2 space-y-2 text-xs text-[var(--color-text-muted)]">
          {FREE_DATA_SOURCES.map((s) => (
            <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-bold text-[var(--color-atlas-navy)]">{s.name}</span> — {s.note}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Logging into airline/liner web portals with shared IDs inside Atlas is not supported
          (fragile, against most carrier terms, and unsafe for credentials). Prefer: (1) Circulars
          Excel for contracted buy rates, (2) official carrier APIs / IATA TACT when subscribed,
          (3) Track/Site links above for public tools. Store future API secrets in Firebase
          Functions — never in chat or source.
        </p>
      </Card>
    </div>
  );
}
