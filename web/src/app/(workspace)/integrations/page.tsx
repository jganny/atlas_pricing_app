"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plane, Ship } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import {
  DCSA_CARRIERS,
  DCSA_SPEC_LINKS,
  demoDcsaSchedules,
  type DcsaScheduleSailing,
} from "@/lib/integrations/dcsa";
import {
  ONE_RECORD_AIRLINES,
  ONE_RECORD_LINKS,
  demoOneRecordShipment,
} from "@/lib/integrations/one-record";

export default function IntegrationsPage() {
  const [origin, setOrigin] = useState("INNSA");
  const [destination, setDestination] = useState("NLRTM");
  const [sailings, setSailings] = useState<DcsaScheduleSailing[]>([]);

  const shipment = useMemo(
    () =>
      demoOneRecordShipment({
        origin: "BLR",
        destination: "LHR",
        weightKg: 250,
        pieces: 2,
      }),
    [],
  );

  function runDemo() {
    setSailings(
      demoDcsaSchedules({
        originUnLocode: origin,
        destinationUnLocode: destination,
      }),
    );
  }

  useEffect(() => {
    runDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- demo on first paint only
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Standards-first integrations
        </p>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
          DCSA ocean · IATA ONE Record air
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">
          DCSA and ONE Record are free open standards — not free live rate gateways. Each carrier
          hosts its own API against a shared schema. Atlas uses that shared shape so we onboard
          once per pattern, then plug credentials when you are a contracted customer. The GitHub /
          IATA links are official specs; the JSON panel and Run demo results are shape demos only
          until portal secrets are configured.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="py-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--color-atlas-navy)]">
            <Ship className="h-4 w-4" /> DCSA ocean carriers
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            10 vessel operators ≈ 75% of container trade. Spec free on GitHub; live data needs
            portal accounts.
          </p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">
            {DCSA_CARRIERS.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2"
              >
                <div>
                  <div className="font-bold text-[var(--color-atlas-navy)]">
                    {c.name} · {c.scac}
                  </div>
                  <div className="text-[var(--color-text-muted)]">{c.note}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.capabilities.map((cap) => (
                      <Badge key={cap} tone="neutral">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
                <a
                  href={c.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-sky-800 hover:underline"
                  title="Developer / eCommerce portal"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
          <a
            href={DCSA_SPEC_LINKS.openApi}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:underline"
          >
            DCSA OpenAPI on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </Card>

        <Card className="py-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--color-atlas-navy)]">
            <Plane className="h-4 w-4" /> IATA ONE Record (air)
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Preferred IATA data-sharing model (JSON-LD). Earlier-stage than DCSA — build toward it;
            Circulars remain the live rate source.
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {ONE_RECORD_AIRLINES.map((a) => (
              <li
                key={a.code}
                className="rounded-lg border border-[var(--color-border)] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--color-atlas-navy)]">
                    {a.code} · {a.name}
                  </span>
                  <Badge tone={a.oneRecordStatus === "pilot" ? "info" : "neutral"}>
                    {a.oneRecordStatus}
                  </Badge>
                </div>
                <div className="text-[var(--color-text-muted)]">{a.note}</div>
              </li>
            ))}
          </ul>
          <a
            href={ONE_RECORD_LINKS.iata}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:underline"
          >
            IATA ONE Record <ExternalLink className="h-3 w-3" />
          </a>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-emerald-200">
            {JSON.stringify(shipment, null, 2)}
          </pre>
        </Card>
      </div>

      <Card className="py-4">
        <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
          Demo: DCSA-shaped commercial schedules
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Same response model for every carrier. The demo badge means sample data — swap to live
          when portal credentials are set as Functions secrets.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label>Origin UN/LOCODE</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Destination UN/LOCODE</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={runDemo} className="w-full sm:w-auto">
              Run demo
            </Button>
          </div>
        </div>
        {sailings.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {sailings.map((s) => (
              <li
                key={`${s.carrier}-${s.voyageNumber}`}
                className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[var(--color-atlas-navy)]">
                    {s.carrier} · {s.carrierServiceName}
                  </div>
                  <Badge tone="warn">demo</Badge>
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {s.origin} → {s.destination} · {s.transitDays}d · voyage {s.voyageNumber}
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{s.sourceNote}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="py-4 text-sm">
        <h2 className="font-extrabold text-[var(--color-atlas-navy)]">What you need next</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-[var(--color-text-muted)]">
          <li>Ask each ocean line sales contact for API / developer-portal access (customer account).</li>
          <li>
            Store client id/secret as Firebase secrets (slots reserved: DCSA_* / ONERECORD_*).
          </li>
          <li>Keep using Atlas Circulars for sell rates until those portals are live.</li>
          <li>
            NVOCCs / coloaders are not DCSA members — they consume the same carrier data you will.
          </li>
        </ol>
        <Link
          href="/carriers"
          className="mt-3 inline-block text-xs font-bold text-sky-800 hover:underline"
        >
          Open free carrier directory →
        </Link>
      </Card>
    </div>
  );
}
