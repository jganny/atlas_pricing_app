"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck, Clock, Loader2, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {useLiveData
            ? "Live enquiries from Firestore quotes collection with SLA tracking."
            : "Mock data — mirrors Enquiry DB SLA and Smart Quote entry points."}
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">
            Could not load enquiries. Sign in with your Atlas desk credentials.
          </p>
        </Card>
      ) : null}

      <Card className="border-violet-200 bg-violet-50/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-violet-700">
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-sm font-bold">Migration on hold until full parity</span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Legacy stays production. Track every missing feature and test before cutover.
            </p>
          </div>
          <Link
            href="/feature-parity"
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14154a]"
          >
            Feature parity tracker
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Open enquiries
          </div>
          <div className="mt-2 text-3xl font-extrabold text-[var(--color-atlas-navy)]">
            {isLoading ? "…" : open}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
            <Clock className="h-3.5 w-3.5" />
            Due soon (&gt;4h)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-amber-600">
            {isLoading ? "…" : dueSoon}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Overdue (&gt;8h)
          </div>
          <div className="mt-2 text-3xl font-extrabold text-red-600">
            {isLoading ? "…" : overdue}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-atlas-sky)]" />
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Smart Quote automation</h2>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Paste enquiry → parse → Circulars tariffs → draft quote. Air and Sea modules ported first.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/smart-quote/air"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-atlas-air)]/15 px-3 py-2 text-sm font-semibold text-amber-800"
            >
              Air Smart Quote <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/smart-quote/sea"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-atlas-sea)]/15 px-3 py-2 text-sm font-semibold text-sky-800"
            >
              Sea Smart Quote <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/courier"
              className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-800"
            >
              Courier desk <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-bold text-[var(--color-atlas-navy)]">Recent enquiries</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-3">
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
          )}
        </Card>
      </div>
    </div>
  );
}
