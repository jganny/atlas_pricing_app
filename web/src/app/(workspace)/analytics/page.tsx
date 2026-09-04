"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useEnquiries, useLeads } from "@/hooks/use-atlas-data";
import { formatCurrency } from "@/lib/utils";

export default function AnalyticsPage() {
  const { data: enquiries = [] } = useEnquiries();
  const { data: leads = [] } = useLeads();

  const stats = useMemo(() => {
    const won = enquiries.filter((e) => e.status === "won");
    const quoted = enquiries.filter((e) => e.status === "quoted" || e.status === "open");
    const revenue = won.reduce((s, e) => s + (e.amountINR || e.grandTotal || 0), 0);
    const gp = won.reduce((s, e) => s + (e.grossProfit || 0), 0);
    const byMode: Record<string, number> = {};
    enquiries.forEach((e) => {
      byMode[e.mode] = (byMode[e.mode] || 0) + 1;
    });
    const byDesk: Record<string, number> = {};
    enquiries.forEach((e) => {
      byDesk[e.assignee || e.creator] = (byDesk[e.assignee || e.creator] || 0) + 1;
    });
  const salesPipeline = leads
    .filter((l) => l.status !== "won" && l.status !== "lost")
    .reduce((s, l) => s + (l.dealValue || 0), 0);
  const enquiryPipeline = enquiries
    .filter((e) => e.status === "open" || e.status === "quoted")
    .reduce((s, e) => s + (e.amountINR || e.grandTotal || 0), 0);
  const pipeline = salesPipeline > 0 ? salesPipeline : enquiryPipeline;
    return { won: won.length, quoted: quoted.length, revenue, gp, byMode, byDesk, pipeline };
  }, [enquiries, leads]);

  const topDesks = Object.entries(stats.byDesk)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Analytics</h1>
        <Badge tone="info">Phase 13</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Won</div>
          <div className="text-2xl font-extrabold">{stats.won}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Open</div>
          <div className="text-2xl font-extrabold">{stats.quoted}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
            Won revenue
          </div>
          <div className="text-xl font-extrabold">{formatCurrency(stats.revenue, "INR")}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
            Sales pipeline
          </div>
          <div className="text-xl font-extrabold">{formatCurrency(stats.pipeline, "INR")}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Volume by mode</h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(stats.byMode).map(([mode, n]) => (
              <li key={mode} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="capitalize">{mode}</span>
                <span className="font-bold">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Staff leaderboard</h2>
          <ul className="space-y-2 text-sm">
            {topDesks.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No quotes yet.</li>
            ) : (
              topDesks.map(([desk, n], i) => (
                <li key={desk} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>
                    #{i + 1} {desk}
                  </span>
                  <span className="font-bold">{n}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
