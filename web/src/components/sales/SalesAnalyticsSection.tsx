"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui";
import { averageCycleTimeDays, cycleTimeDays } from "@/lib/sales/cycle-time";
import { repLeaderboard } from "@/lib/sales/rep-leaderboard";
import { averageDealSize, lossReasonBreakdown, winRate } from "@/lib/sales/win-loss";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import type { SalesLead } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Sales-pipeline analytics from leads — separate from the quoting-volume cards above it. */
export function SalesAnalyticsSection({ leads }: { leads: SalesLead[] }) {
  const stats = useMemo(() => {
    const closed = leads.filter((l) => l.status === "won" || l.status === "lost");
    return {
      closed: closed.length,
      winRate: winRate(leads),
      avgWon: averageDealSize(leads, "won"),
      cycle: averageCycleTimeDays(leads),
      cycleN: closed.filter((l) => cycleTimeDays(l) != null).length,
      reasons: lossReasonBreakdown(leads),
      board: repLeaderboard(leads),
    };
  }, [leads]);

  return (
    <div className="space-y-3" data-testid="sales-analytics">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-atlas-navy)]">
        Sales pipeline performance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Win rate</div>
          <div className="text-2xl font-extrabold">{pct(stats.winRate)}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">of {stats.closed} closed leads (won ÷ won + lost)</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Average won deal</div>
          <div className="text-xl font-extrabold">{stats.avgWon == null ? "—" : formatCurrency(stats.avgWon, "INR")}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Avg sales cycle</div>
          <div className="text-xl font-extrabold">{stats.cycle == null ? "—" : `${stats.cycle.toFixed(1)} days`}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            {stats.cycleN} lead{stats.cycleN === 1 ? "" : "s"} measured — only leads closed since v0.3.43 carry close dates
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-bold">Sales leaderboard (won revenue)</h3>
          {stats.board.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No leads yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="py-1">Rep</th>
                  <th className="py-1 text-right">Won</th>
                  <th className="py-1 text-right">Lost</th>
                  <th className="py-1 text-right">Win %</th>
                  <th className="py-1 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.board.slice(0, 8).map((r, i) => (
                  <tr key={r.owner} className="border-t">
                    <td className="py-1.5">
                      #{i + 1} {TEAM_ROLES[r.owner]?.name || r.owner}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{r.won}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.lost}</td>
                    <td className="py-1.5 text-right tabular-nums">{pct(r.winRate)}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums">{formatCurrency(r.revenue, "INR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-bold">Why we lose</h3>
          {stats.reasons.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No lost leads yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.reasons.map((r) => (
                <li key={r.code} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{r.label}</span>
                  <span className="font-bold tabular-nums">
                    {r.count} · {formatCurrency(r.value, "INR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
