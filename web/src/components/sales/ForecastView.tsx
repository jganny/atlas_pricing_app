"use client";

import { useMemo } from "react";
import { Badge, Card } from "@/components/ui";
import { useLeads } from "@/hooks/use-atlas-data";
import {
  UNSCHEDULED,
  effectiveProbability,
  forecastByMonth,
  forecastByStage,
  isOpenLead,
  weightedForecastValue,
  weightedPipelineTotal,
} from "@/lib/sales/forecast";
import { computeLeadScore, scoreTone } from "@/lib/sales/lead-scoring";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import { formatCurrency } from "@/lib/utils";

function monthLabel(key: string): string {
  if (key === UNSCHEDULED) return "No close date";
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ForecastView() {
  const { data: leads = [], isLoading } = useLeads();

  const open = useMemo(() => leads.filter(isOpenLead), [leads]);
  const byStage = useMemo(() => forecastByStage(leads), [leads]);
  const byMonth = useMemo(() => forecastByMonth(leads), [leads]);
  const weighted = useMemo(() => weightedPipelineTotal(leads), [leads]);
  const won = useMemo(
    () => leads.filter((l) => l.status === "won").reduce((s, l) => s + (l.dealValue || 0), 0),
    [leads],
  );
  const openTotal = open.reduce((s, l) => s + (l.dealValue || 0), 0);

  const ranked = useMemo(() => {
    const now = Date.now();
    return open
      .map((lead) => ({ lead, score: computeLeadScore(lead, now) }))
      .sort((a, b) => b.score.total - a.score.total || (b.lead.dealValue || 0) - (a.lead.dealValue || 0));
  }, [open]);

  if (isLoading) return <Card>Loading forecast…</Card>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm sm:grid-cols-4" data-testid="forecast-kpi-strip">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Open leads</div>
          <div className="text-lg font-extrabold">{open.length}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Open pipeline</div>
          <div className="text-sm font-extrabold">{formatCurrency(openTotal, "INR")}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Weighted forecast</div>
          <div className="text-sm font-extrabold text-sky-800">{formatCurrency(weighted, "INR")}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Won to date</div>
          <div className="text-sm font-extrabold text-emerald-700">{formatCurrency(won, "INR")}</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-bold">By stage</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="py-1">Stage</th>
                <th className="py-1 text-right">Leads</th>
                <th className="py-1 text-right">Pipeline</th>
                <th className="py-1 text-right">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {byStage.map((b) => (
                <tr key={b.key} className="border-t">
                  <td className="py-1.5 font-semibold capitalize">{b.key}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(b.total, "INR")}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(b.weighted, "INR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="text-sm font-bold">By expected close month</h2>
          {byMonth.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">No open leads.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="py-1">Month</th>
                  <th className="py-1 text-right">Leads</th>
                  <th className="py-1 text-right">Pipeline</th>
                  <th className="py-1 text-right">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((b) => (
                  <tr key={b.key} className="border-t">
                    <td className="py-1.5 font-semibold">{monthLabel(b.key)}</td>
                    <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCurrency(b.total, "INR")}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatCurrency(b.weighted, "INR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            Set an expected close date on a lead (Pipeline → Edit) to place it in a month.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold">Open leads by score</h2>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Score is additive and explainable — hover a score to see exactly which factors added or removed points.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2 text-right">Deal (INR)</th>
                <th className="px-3 py-2 text-right">Prob.</th>
                <th className="px-3 py-2 text-right">Weighted</th>
                <th className="px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    No open leads.
                  </td>
                </tr>
              ) : (
                ranked.map(({ lead, score }) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="px-3 py-2" title={score.factors.map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`).join("\n") || "No factors yet"}>
                      <Badge tone={scoreTone(score.total)}>{score.total}</Badge>
                    </td>
                    <td className="px-3 py-2 font-semibold">{lead.company}</td>
                    <td className="px-3 py-2 capitalize">{lead.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {lead.dealValue ? formatCurrency(lead.dealValue, "INR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{effectiveProbability(lead)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(weightedForecastValue(lead), "INR")}
                    </td>
                    <td className="px-3 py-2">{TEAM_ROLES[lead.owner || ""]?.name || lead.owner || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
