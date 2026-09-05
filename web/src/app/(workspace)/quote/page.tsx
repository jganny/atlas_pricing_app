"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronRight,
  Inbox,
  Package,
  Plane,
  Ship,
  Sparkles,
  Truck,
} from "lucide-react";
import { PremiumQuoteOverlay } from "@/components/PremiumQuoteOverlay";
import { Button, Card } from "@/components/ui";
import { getImapMailboxStatus } from "@/lib/mail/imap-config";

const MODES = [
  {
    id: "all",
    title: "All modes",
    blurb: "Compare air, sea, and road lane estimates in one overlay.",
    icon: Sparkles,
    action: "overlay" as const,
  },
  {
    id: "air",
    title: "Air freight",
    blurb: "Airline options → open Air desk for full tariff quote.",
    icon: Plane,
    href: "/air",
    smart: "/smart-quote/air",
  },
  {
    id: "sea",
    title: "Sea freight",
    blurb: "Liner options → open Sea desk for FCL/LCL quoting.",
    icon: Ship,
    href: "/sea",
    smart: "/smart-quote/sea",
  },
  {
    id: "courier",
    title: "Courier / express",
    blurb: "Parcel and express desk for door-to-door moves.",
    icon: Package,
    href: "/courier",
  },
  {
    id: "road",
    title: "Road / transport",
    blurb: "Domestic and inland haulage desk.",
    icon: Truck,
    href: "/transport",
  },
];

export default function QuoteHubPage() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [selected, setSelected] = useState("air");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="overflow-hidden rounded-2xl bg-[var(--color-atlas-navy)] px-5 py-6 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">
          Request a quote
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">What are you shipping?</h1>
        <p className="mt-2 max-w-xl text-sm text-white/75">
          Pick a mode to start. Mobile keeps this hub lean — deep tariff desks and reports stay one
          tap away on larger screens.
        </p>
        <Button
          type="button"
          className="mt-4 bg-teal-500 hover:bg-teal-400"
          onClick={() => setOverlayOpen(true)}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          Quick rate finder
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-[var(--color-border)]">
          {MODES.map((m) => {
            const active = selected === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`flex w-full items-start gap-3 px-4 py-4 text-left transition ${
                    active ? "bg-sky-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? "bg-[var(--color-atlas-navy)] text-white"
                        : "bg-slate-100 text-[var(--color-atlas-navy)]"
                    }`}
                  >
                    <m.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {active ? (
                        <span className="h-4 w-1 rounded-full bg-teal-500" aria-hidden />
                      ) : (
                        <span className="w-1" aria-hidden />
                      )}
                      <span className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                        {m.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                      {m.blurb}
                    </span>
                    {active ? (
                      <span className="mt-3 flex flex-wrap gap-2">
                        {"action" in m && m.action === "overlay" ? (
                          <button
                            type="button"
                            onClick={() => setOverlayOpen(true)}
                            className="inline-flex items-center gap-1 text-sm font-bold text-sky-800 hover:underline"
                          >
                            New quote <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {"href" in m && m.href ? (
                          <Link
                            href={m.href}
                            className="inline-flex items-center gap-1 text-sm font-bold text-sky-800 hover:underline"
                          >
                            Open desk <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                        {"smart" in m && m.smart ? (
                          <Link
                            href={m.smart}
                            className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:underline"
                          >
                            Smart quote <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <Link
            href="/enquiries"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-atlas-navy)] hover:underline"
          >
            <Inbox className="h-4 w-4" />
            My quotes / enquiry DB
          </Link>
        </div>
      </Card>

      <Card className="py-4">
        <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
          Email automation (IMAP)
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Ready for pricing / pricingsales mailboxes. Share passwords when you want — they go in
          server secrets only, never in the app bundle.
        </p>
        <ul className="mt-3 space-y-2">
          {getImapMailboxStatus().map((box) => (
            <li
              key={box.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
            >
              <div>
                <div className="font-bold text-[var(--color-atlas-navy)]">{box.label}</div>
                <div className="text-[var(--color-text-muted)]">{box.note}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  box.configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                }`}
              >
                {box.configured ? "User set" : "Awaiting secrets"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <PremiumQuoteOverlay open={overlayOpen} onOpenChange={setOverlayOpen} />
    </div>
  );
}
