"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, RefreshCw, XCircle } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { toast } from "@/components/Toast";
import { getAiUsageSummary, saveAiBilling } from "@/lib/firebase/ai-usage";
import {
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

const TONE: Record<CreditTone, { box: string; icon: typeof CheckCircle2; iconCls: string }> = {
  out: { box: "border-red-300 bg-red-50", icon: XCircle, iconCls: "text-red-700" },
  low: { box: "border-amber-300 bg-amber-50", icon: AlertTriangle, iconCls: "text-amber-700" },
  ok: { box: "border-emerald-300 bg-emerald-50", icon: CheckCircle2, iconCls: "text-emerald-700" },
  none: { box: "border-[var(--color-border)] bg-slate-50", icon: CircleHelp, iconCls: "text-slate-500" },
};

const when = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

/** Admin (ganny only): how much AI credit is left, a warning before it runs out, and where each month's AI spend went. */
export function AiUsageAdmin() {
  const [data, setData] = useState<AiSummaryView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [monthIx, setMonthIx] = useState(0);
  const [form, setForm] = useState({ balance: "", lowAt: "", rate: "" });

  const refresh = useCallback(
    () =>
      getAiUsageSummary()
        .then((s) => {
          setError("");
          setData(s);
          setForm((f) => ({
            balance: f.balance,
            lowAt: f.lowAt || String(s.billing?.lowAtUsd ?? s.defaults.lowAtUsd),
            rate: f.rate || String(s.billing?.inrPerUsd ?? s.defaults.inrPerUsd),
          }));
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Could not load AI usage.")),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    const r = readBalanceForm(form);
    if (!r.ok) {
      toast(r.message, "error");
      return;
    }
    setBusy(true);
    try {
      await saveAiBilling({ balanceUsd: r.balanceUsd, lowAtUsd: r.lowAtUsd, inrPerUsd: r.inrPerUsd });
      toast("Balance saved. The app will count down from it.", "success");
      setForm((f) => ({ ...f, balance: "" }));
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const status = data ? creditStatus(data) : null;
  const rate = data?.billing?.inrPerUsd ?? data?.defaults.inrPerUsd ?? 90;
  const month = data?.months[monthIx] ?? null;
  const maxDay = month ? Math.max(0.0001, ...month.days.map((d) => d.costUsd)) : 1;

  return (
    <Card className="space-y-3" id="ai-usage">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">AI credit and cost</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()} aria-label="Refresh AI usage">
          <RefreshCw size={14} aria-hidden />
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !data || !status ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <>
          {/* Where the credit stands */}
          <div className={cn("flex gap-3 rounded-lg border p-3", TONE[status.tone].box)} data-testid="ai-credit-status" data-tone={status.tone}>
            {(() => {
              const Icon = TONE[status.tone].icon;
              return <Icon size={20} className={cn("mt-0.5 shrink-0", TONE[status.tone].iconCls)} aria-hidden />;
            })()}
            <div className="min-w-0">
              <p className="text-sm font-bold">{status.headline}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{status.detail}</p>
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
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-sm font-semibold">After you add credit, type the balance shown in the Anthropic Console</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="ai-balance">Balance now (US $)</Label>
                <Input id="ai-balance" inputMode="decimal" placeholder="for example 50" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ai-low">Warn me below (US $)</Label>
                <Input id="ai-low" inputMode="decimal" value={form.lowAt} onChange={(e) => setForm({ ...form, lowAt: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ai-rate">Rupees per dollar</Label>
                <Input id="ai-rate" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" size="sm" disabled={busy || !form.balance.trim()} onClick={() => void save()} data-testid="ai-save-balance">
                {busy ? "Saving…" : "Save balance"}
              </Button>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                The AI service cannot tell the app its balance, so this is an estimate: your number minus what the app has spent since. Small differences are normal. Re-enter after every top-up.
              </p>
            </div>
          </div>

          {/* Where it went */}
          {data.months.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No AI use counted yet. Counting starts with the first AI call after this was switched on.</p>
          ) : month ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {data.months.map((m, i) => (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setMonthIx(i)}
                    className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", i === monthIx ? "border-[var(--color-atlas-navy)] bg-[var(--color-atlas-navy)] text-white" : "border-[var(--color-border)] bg-white")}
                  >
                    {monthLabel(m.month)}
                  </button>
                ))}
              </div>

              <p className="text-sm" data-testid="ai-month-total">
                <span className="text-xl font-extrabold">{fmtUsd(month.total.costUsd)}</span>{" "}
                <span className="font-semibold">({fmtInr(month.total.costUsd, rate)})</span>{" "}
                <span className="text-[var(--color-text-muted)]">
                  in {monthLabel(month.month)} · {month.total.calls.toLocaleString("en-IN")} AI calls · {fmtTokens(month.total.input)} read · {fmtTokens(month.total.output)} written
                  {month.total.web ? ` · ${month.total.web} web searches` : ""}
                </span>
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] text-[10px] uppercase text-[var(--color-text-muted)]">
                    <tr>
                      <th className="py-1.5">What used it</th>
                      <th className="py-1.5 text-right">Calls</th>
                      <th className="py-1.5 text-right">Read</th>
                      <th className="py-1.5 text-right">Written</th>
                      <th className="py-1.5 text-right">Searches</th>
                      <th className="py-1.5 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {month.features.map((f) => (
                      <tr key={f.key} className="border-b border-[var(--color-border)]/60">
                        <td className="py-1.5 font-medium">{featureLabel(f.key)}</td>
                        <td className="py-1.5 text-right tabular-nums">{f.calls.toLocaleString("en-IN")}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtTokens(f.input)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtTokens(f.output)}</td>
                        <td className="py-1.5 text-right tabular-nums">{f.web || ""}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{fmtUsd(f.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-[var(--color-text-muted)]">
                By AI model: {month.models.map((m) => `${modelLabel(m.key)} ${fmtUsd(m.costUsd)}`).join(" · ") || "none"}
              </p>

              {month.days.length > 1 ? (
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-[var(--color-text-muted)]">Cost per day</p>
                  <div className="flex h-14 items-end gap-1" role="img" aria-label="Cost per day this month">
                    {month.days.map((d) => (
                      <div key={d.day} className="flex flex-1 flex-col items-center justify-end" title={`${d.day} ${monthLabel(month.month)}: ${fmtUsd(d.costUsd)}, ${d.calls} calls`}>
                        <div className="w-full rounded-sm bg-[var(--color-atlas-sky)]" style={{ height: `${Math.max(4, (d.costUsd / maxDay) * 48)}px` }} />
                        <span className="mt-0.5 text-[9px] text-[var(--color-text-muted)]">{Number(d.day)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="text-[11px] text-[var(--color-text-muted)]">
            {data.countingSince ? `Counting started ${when(data.countingSince)}; earlier use is not included. ` : ""}
            Costs use the published price per million words-worth of AI reading and writing (tokens), and $10 per 1,000 web searches. Your Anthropic Console bill is the final word.
          </p>
        </>
      )}
    </Card>
  );
}
