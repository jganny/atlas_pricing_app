"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck, Clock, Sparkles } from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { openNewQuoteLauncher } from "@/components/NewQuoteLauncher";
import { Badge, Button, Card } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useLiveData } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { data: enquiries = [], isLoading, error } = useEnquiries();

  const open = enquiries.filter((e) => e.status === "open" || e.status === "quoted").length;
  const overdue = enquiries.filter((e) => e.slaHoursOpen > 8).length;
  const dueSoon = enquiries.filter(
    (e) => e.slaHoursOpen > 4 && e.slaHoursOpen <= 8,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {useLiveData
              ? "Live enquiries — updates automatically. Press ⌘K to jump anywhere."
              : "Mock data — mirrors Enquiry DB SLA and Smart Quote entry points."}
          </p>
        </div>
        <Button type="button" className="h-9" onClick={openNewQuoteLauncher}>
          <Sparkles className="mr-1.5 h-4 w-4" />
          New quote from enquiry
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 py-3">
          <p className="text-sm font-semibold text-red-800">
            Could not load enquiries. Sign in with your Atlas desk credentials.
          </p>
        </Card>
      ) : null}

      <Card className="border-violet-200 bg-violet-50/60 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-sm font-bold">New version — parity + premium tech from Phase 0</span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Legacy stays production until you approve. Track parity and innovation — no leaf unturned.
            </p>
          </div>
          <Link
            href="/feature-parity"
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14154a]"
          >
            Trackers
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Open enquiries
              </div>
              <div className="mt-2 text-3xl font-extrabold text-[var(--color-atlas-navy)]">{open}</div>
            </Card>
            <Card className="py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                Due soon (&gt;4h)
              </div>
              <div className="mt-2 text-3xl font-extrabold text-amber-600">{dueSoon}</div>
            </Card>
            <Card className="py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue (&gt;8h)
              </div>
              <div className="mt-2 text-3xl font-extrabold text-red-600">{overdue}</div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-sky-200 bg-sky-50/40 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-atlas-sky)]" />
                <h2 className="font-bold text-[var(--color-atlas-navy)]">Start a quote</h2>
                <Badge tone="info">Option B</Badge>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                Paste an enquiry once — AI detects Air vs Sea and opens the desk prefilled. Or jump
                straight to a desk / inbox.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className="h-9" onClick={openNewQuoteLauncher}>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  New quote from enquiry
                </Button>
                <Link
                  href="/air"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-amber-800"
                >
                  Air desk
                </Link>
                <Link
                  href="/sea"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-sky-800"
                >
                  Sea desk
                </Link>
                <Link
                  href="/inbox"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-violet-800"
                >
                  Inbox
                </Link>
                <Link
                  href="/courier"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  Courier
                </Link>
              </div>
            </Card>

            <Card className="py-3">
              <h2 className="mb-3 font-bold text-[var(--color-atlas-navy)]">Recent enquiries</h2>
              <div className="space-y-2">
                {enquiries.slice(0, 4).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-semibold">{e.ref}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {e.customer} · {e.origin} → {e.destination}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        tone={
                          e.status === "open" || e.status === "quoted"
                            ? "warn"
                            : e.status === "won"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {e.status}
                      </Badge>
                      {e.grandTotal ? (
                        <div className="mt-1 text-xs font-bold">{formatCurrency(e.grandTotal)}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
