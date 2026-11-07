"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleHelp, RefreshCw, XCircle } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { toast } from "@/components/Toast";
import { getAiUsageSummary, saveAiBilling } from "@/lib/firebase/ai-usage";
import {
  chartScale,
  creditStatus,
  featureLabel,
  fmtInr,
  fmtTokens,
  fmtUsd,
  modelLabel,
  monthLabel,
  readBalanceForm,
  type AiSummaryView,
  type CreditTone,
} from "@/lib/ai/ai-usage-view";
import { cn } from "@/lib/utils";

const TONE: Record<CreditTone, { box: string; icon: typeof CheckCircle2; iconCls: string; ring: string }> = {
  out: { box: "bg-red-50", icon: XCircle, iconCls: "text-red-700", ring: "#c53030" },
  low: { box: "bg-amber-50", icon: AlertTriangle, iconCls: "text-amber-700", ring: "#b7791f" },
  ok: { box: "bg-emerald-50", icon: CheckCircle2, iconCls: "text-emerald-700", ring: "#2f7a5c" },
  none: { box: "border border-[var(--color-border)] bg-slate-50", icon: CircleHelp, iconCls: "text-slate-500", ring: "#6b8499" },
};

const when = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function Ring({ tone, fraction, label, caption }: { tone: CreditTone; fraction: number; label: string; caption: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${label} ${caption}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="white" strokeWidth="9" opacity="0.8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={TONE[tone].ring} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <b className="text-xl font-bold leading-tight tabular-nums">{label}</b>
        <span className="text-[11px] text-[var(--color-text-muted)]">{caption}</span>
      </div>
    </div>
  );
}

function DayChart({ days, monthName }: { days: Array<{ day: string; costUsd: number; calls: number }>; monthName: string }) {
  const W = 520;
  const H = 170;
  const L = 40;
  const B = 24;
  const T = 14;
  const { max, ticks } = chartScale(days.map((d) => d.costUsd));
  const iw = W - L - 8;
  const ih = H - B - T;
  const slot = iw / days.length;
  const bw = Math.min(40, slot * 0.58);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Cost per day in ${monthName}`}>
      {ticks.map((v) => {
        const y = T + ih - (v / max) * ih;
        return (
          <g key={v}>
            <line x1={L} x2={W - 8} y1={y} y2={y} stroke="#d3dbe3" strokeDasharray="3 4" />
            <text x={L - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8a95a1">
              ${v}
            </text>
          </g>
        );
      })}
      {days.map((d, i) => {
        const h = (d.costUsd / max) * ih;
        const x = L + slot * i + (slot - bw) / 2;
        const y = T + ih - h;
        const last = i === days.length - 1;
        return (
          <g key={d.day}>
            <title>{`${Number(d.day)} ${monthName}: ${fmtUsd(d.costUsd)}, ${d.calls} calls`}</title>
            <rect x={x} y={y} width={bw} height={Math.max(h, 1)} rx="5" fill={last ? "#323843" : "#6b8499"} opacity={last ? 1 : 0.6} />
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#8a95a1">
              {Number(d.day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Admin (ganny only): how much AI credit is left, a warning before it runs out, and where each month's AI spend went. */
export function AiUsageAdmin() {
  const qc = useQueryClient();
  // Same cache key as the tile at the top of the Admin console, so opening this section does not fetch twice.
  const q = useQuery<AiSummaryView>({ queryKey: ["adminAiSummary"], queryFn: getAiUsageSummary, staleTime: 60_000, retry: 0 });
  const data = q.data ?? null;
  const [busy, setBusy] = useState(false);
  const [monthIx, setMonthIx] = useState(0);
  const [form, setForm] = useState<{ balance: string; lowAt: string | null; rate: string | null }>({ balance: "", lowAt: null, rate: null });

  const lowAt = form.lowAt ?? String(data?.billing?.lowAtUsd ?? data?.defaults.lowAtUsd ?? 10);
  const rateText = form.rate ?? String(data?.billing?.inrPerUsd ?? data?.defaults.inrPerUsd ?? 90);

  async function save() {
    const r = readBalanceForm({ balance: form.balance, lowAt, rate: rateText });
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setBusy(true);
    try {
      await saveAiBilling({ balanceUsd: r.balanceUsd, lowAtUsd: r.lowAtUsd, inrPerUsd: r.inrPerUsd });
      toast("Balance saved. The app will count down from it.", "success");
      setForm({ balance: "", lowAt: null, rate: null });
      await qc.invalidateQueries({ queryKey: ["adminAiSummary"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const status = data ? creditStatus(data) : null;
  const rate = data?.billing?.inrPerUsd ?? data?.defaults.inrPerUsd ?? 90;
  const month = data?.months[monthIx] ?? null;
  const est = data?.billing?.estimateUsd ?? null;
  const base = Math.max(data?.billing?.balanceUsd ?? 0, est ?? 0, 0.01);
  const fraction = status?.tone === "out" || est === null ? 0 : Math.max(0, est) / base;
  const ringLabel = status?.tone === "out" ? "$0.00" : est === null ? "Not set" : fmtUsd(Math.max(0, est));
  const maxFeature = month ? Math.max(0.0001, ...month.features.map((f) => f.costUsd)) : 1;

  return (
    <Card className="space-y-4" id="ai-usage">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">AI credit and cost</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => void q.refetch()} aria-label="Refresh AI usage">
          <RefreshCw size={14} className={q.isFetching ? "animate-spin" : ""} aria-hidden />
        </Button>
      </div>

      {q.isError ? (
        <p className="text-sm text-red-700">{q.error instanceof Error ? q.error.message : "Could not load AI usage."}</p>
      ) : !data || !status ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <>
          {/* Where the credit stands */}
          <div className={cn("flex flex-wrap items-center gap-5 rounded-2xl p-4 sm:flex-nowrap", TONE[status.tone].box)} data-testid="ai-credit-status" data-tone={status.tone}>
            <Ring tone={status.tone} fraction={fraction} label={ringLabel} caption={status.tone === "none" ? "balance needed" : "estimated left"} />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-lg font-bold">
                {(() => {
                  const Icon = TONE[status.tone].icon;
                  return <Icon size={20} className={cn("shrink-0", TONE[status.tone].iconCls)} aria-hidden />;
                })()}
                {status.headline}
              </p>
              <p className="mt-1 max-w-[60ch] text-[13px] text-[var(--color-text-muted)]">{status.detail}</p>
              {data.status.outOfCredit && data.status.since ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  First noticed {when(data.status.since)}
                  {data.status.lastFeature ? ` in ${featureLabel(data.status.lastFeature)}` : ""}.
                </p>
              ) : null}
              {data.billing?.alertedAt ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">Warning sent to your phone {when(data.billing.alertedAt)}.</p> : null}
            </div>
          </div>

          {/* The one thing to type after each top-up */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50/70 p-4">
            <p className="text-sm font-semibold">After you add credit, type the balance shown in the Anthropic Console</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[150px] flex-1">
                <Label htmlFor="ai-balance" className="text-xs text-[var(--color-text-muted)]">
                  Balance now (US $)
                </Label>
                <Input id="ai-balance" inputMode="decimal" placeholder="for example 50" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
              <div className="min-w-[150px] flex-1">
                <Label htmlFor="ai-low" className="text-xs text-[var(--color-text-muted)]">
                  Warn me below (US $)
                </Label>
                <Input id="ai-low" inputMode="decimal" value={lowAt} onChange={(e) => setForm({ ...form, lowAt: e.target.value })} />
              </div>
              <div className="min-w-[150px] flex-1">
                <Label htmlFor="ai-rate" className="text-xs text-[var(--color-text-muted)]">
                  Rupees per dollar
                </Label>
                <Input id="ai-rate" inputMode="decimal" value={rateText} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
              <Button type="button" disabled={busy || !form.balance.trim()} onClick={() => void save()} data-testid="ai-save-balance">
                {busy ? "Saving…" : "Save balance"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              The AI service cannot tell the app its balance, so this is an estimate: your number minus what the app has spent since. Small differences are normal. Re-enter it after every top-up.
            </p>
          </div>

          {/* Where it went */}
          {data.months.length === 0 || !month ? (
            <p className="text-sm text-[var(--color-text-muted)]">No AI use counted yet. Counting starts with the first AI call after this was switched on.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {data.months.map((m, i) => (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setMonthIx(i)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      i === monthIx ? "border-[var(--color-atlas-navy)] bg-[var(--color-atlas-navy)] text-white" : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]",
                    )}
                  >
                    {monthLabel(m.month)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="ai-month-total">
                {[
                  { l: `${monthLabel(month.month)} so far`, v: fmtUsd(month.total.costUsd) },
                  { l: "In rupees", v: fmtInr(month.total.costUsd, rate) },
                  { l: "AI calls", v: month.total.calls.toLocaleString("en-IN") },
                  { l: "Words read / written", v: `${fmtTokens(month.total.input)} / ${fmtTokens(month.total.output)}` },
                ].map((k) => (
                  <div key={k.l} className="rounded-xl bg-slate-50 px-3.5 py-3">
                    <p className="text-xs text-[var(--color-text-muted)]">{k.l}</p>
                    <p className="text-xl font-bold tabular-nums">{k.v}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div>
                  <h3 className="mb-2.5 text-[13px] font-semibold text-[var(--color-text-muted)]">What used it</h3>
                  <ul className="space-y-3">
                    {month.features.map((f) => (
                      <li key={f.key}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">{featureLabel(f.key)}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtUsd(f.costUsd)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <div className="h-full rounded-full bg-[var(--color-atlas-sky)]" style={{ width: `${Math.max(2, (f.costUsd / maxFeature) * 100)}%` }} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {f.calls.toLocaleString("en-IN")} call{f.calls === 1 ? "" : "s"} · {fmtTokens(f.input)} read{f.web ? ` · ${f.web} web search${f.web === 1 ? "" : "es"}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-400">By AI model: {month.models.map((m) => `${modelLabel(m.key)} ${fmtUsd(m.costUsd)}`).join(" · ") || "none"}</p>
                </div>
                {month.days.length > 0 ? (
                  <div>
                    <h3 className="mb-2.5 text-[13px] font-semibold text-[var(--color-text-muted)]">Cost per day</h3>
                    <DayChart days={month.days} monthName={monthLabel(month.month)} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            {data.countingSince ? `Counting started ${when(data.countingSince)}; earlier use is not included. ` : ""}
            Costs use the published price per million words-worth of AI reading and writing (tokens), and $10 per 1,000 web searches. Your Anthropic Console bill is the final word.
          </p>
        </>
      )}
    </Card>
  );
}
