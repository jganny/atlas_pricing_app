"use client";

import Link from "next/link";
import { ChevronRight, Package, Plane, Ship, Truck } from "lucide-react";
import { QuoteHubIntake } from "@/components/QuoteHubIntake";
import { Card } from "@/components/ui";

const DESKS = [
  {
    title: "Air freight",
    blurb: "Airline / coloader options on the Air desk.",
    icon: Plane,
    href: "/air",
  },
  {
    title: "Sea freight",
    blurb: "Liner / coloader FCL · LCL on the Sea desk.",
    icon: Ship,
    href: "/sea",
  },
  {
    title: "Courier",
    blurb: "Express parcels, door to door.",
    icon: Package,
    href: "/courier",
  },
  {
    title: "Road / warehouse",
    blurb: "Haulage and storage desks.",
    icon: Truck,
    href: "/transport",
  },
];

export default function QuoteHubPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl bg-[var(--color-atlas-navy)] px-6 py-7 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-atlas-gold-bright)]">Quote hub</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Dump the job. Vertex routes it.</h1>
        <p className="mt-2 max-w-lg text-sm text-white/75">
          Do not pick Air vs Sea first. Paste the enquiry or tap what Vertex already queued. Finding
          an old quote stays on Home in Ask Vertex.
        </p>
      </div>

      <QuoteHubIntake />

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          I already know the desk
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DESKS.map((d) => (
            <Link key={d.href} href={d.href}>
              <Card className="atlas-pop h-full transition hover:border-[var(--color-atlas-gold)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-atlas-navy)] text-white">
                    <d.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="flex items-center gap-1 text-sm font-extrabold text-[var(--color-atlas-navy)]">
                      {d.title}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                      {d.blurb}
                    </span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
