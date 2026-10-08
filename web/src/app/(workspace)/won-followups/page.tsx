"use client";

import { useMemo, useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, Input, Label, NumberInput } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useWonFollowUps } from "@/hooks/use-atlas-data";
import { upsertWonFollowUp, type WonFollowUpRow } from "@/lib/firebase/won-followups";
import {
  WON_FOLLOWUP_FIELD_LABELS,
  escalationTier,
  missingWonFields,
  splitWonRows,
  type EscalationTier,
  type WonFollowUpValues,
} from "@/lib/quotes/won-followups";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<EscalationTier, { card: string; badge: string; label: string }> = {
  quiet: { card: "border-[var(--color-border)]", badge: "bg-slate-100 text-slate-700", label: "Won recently" },
  amber: { card: "border-2 border-amber-400 bg-amber-50/60", badge: "bg-amber-200 text-amber-900", label: "Getting overdue" },
  red: { card: "border-2 border-red-500 bg-red-50/70", badge: "bg-red-600 text-white", label: "Overdue" },
};

function daysLabel(wonAt: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(wonAt).getTime()) / 86_400_000));
  if (days <= 0) return "Won today";
  if (days === 1) return "Won 1 day ago";
  return `Won ${days} days ago`;
}

export default function WonFollowUpsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: rows = [], isLoading } = useWonFollowUps();
  const [drafts, setDrafts] = useState<Record<string, Partial<WonFollowUpValues>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const draftFor = (row: WonFollowUpRow): WonFollowUpRow => ({ ...row, ...(drafts[row.id] || {}) });

  function patch(id: string, next: Partial<WonFollowUpValues>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  // Membership comes from the saved rows, so a row stays on screen while it is being typed in.
  const { pending: pendingSaved, complete: completeAll } = useMemo(() => splitWonRows(rows), [rows]);
  const pending = pendingSaved;
  const complete = useMemo(() => completeAll.slice(0, 20), [completeAll]);

  async function save(row: WonFollowUpRow) {
    setSaving(row.id);
    try {
      const d = draftFor(row);
      await upsertWonFollowUp(
        {
          quoteId: d.quoteId,
          ref: d.ref,
          customer: d.customer,
          shipperName: d.shipperName,
          consigneeName: d.consigneeName,
          commodity: d.commodity,
          buyRate: d.buyRate,
          sellAmount: d.sellAmount,
        },
        user?.username || "",
      );
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      const stillMissing = missingWonFields(d);
      toast(stillMissing.length ? "Saved — still missing some details." : "All details filled in.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <BellRing className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Won follow-ups</h1>
        <Badge tone={pending.length ? "warn" : "success"}>{pending.length} pending</Badge>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Shipper, consignee, commodity, buy rate and sell amount — whatever was still blank when a
        quote was converted to Won. Fill in a field and save; a row drops off this list the moment
        nothing's missing. The longer a row sits, the louder it gets — nothing here ever blocks you
        from working.
      </p>

      {isLoading ? (
        <Card className="text-sm text-[var(--color-text-muted)]">Loading…</Card>
      ) : pending.length === 0 ? (
        <Card className="text-sm text-[var(--color-text-muted)]">Nothing pending — every Won quote is fully filled in.</Card>
      ) : (
        <div className="space-y-3">
          {pending.map((saved) => {
            const row = draftFor(saved);
            const tier = escalationTier(row.wonAt);
            const style = TIER_STYLE[tier];
            const missing = missingWonFields(saved);
            const nowMissing = missingWonFields(row);
            return (
              <Card key={row.id} className={cn("space-y-3", style.card)}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-[var(--color-atlas-navy)]">
                      {row.ref} · {row.customer}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{daysLabel(row.wonAt)}</div>
                  </div>
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", style.badge)}>
                    {style.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {missing.map((f) => (
                    <span key={f} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-atlas-navy)] ring-1 ring-inset ring-[var(--color-border)]">
                      {WON_FOLLOWUP_FIELD_LABELS[f]}
                    </span>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Shipper</Label>
                    <Input value={row.shipperName} onChange={(e) => patch(row.id, { shipperName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Consignee</Label>
                    <Input value={row.consigneeName} onChange={(e) => patch(row.id, { consigneeName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Commodity</Label>
                    <Input value={row.commodity} onChange={(e) => patch(row.id, { commodity: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Buy rate</Label>
                      <NumberInput value={row.buyRate} onValueChange={(n) => patch(row.id, { buyRate: n })} />
                    </div>
                    <div>
                      <Label>Sell amount</Label>
                      <NumberInput value={row.sellAmount} onValueChange={(n) => patch(row.id, { sellAmount: n })} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" size="sm" disabled={saving === row.id} onClick={() => void save(saved)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saving === row.id ? "Saving…" : "Save"}
                  </Button>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {nowMissing.length === 0
                      ? "Everything is filled in — Save to finish this one."
                      : `${nowMissing.length} still to fill: ${nowMissing.map((f) => WON_FOLLOWUP_FIELD_LABELS[f]).join(", ")}`}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {complete.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-[var(--color-text-muted)]">Complete</h2>
          <ul className="space-y-1 text-sm">
            {complete.map((r) => (
              <li key={r.id} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
                <span className="font-semibold">{r.ref}</span> · {r.customer}
                {r.shipperName ? ` · ${r.shipperName}` : ""}
                {r.consigneeName ? ` → ${r.consigneeName}` : ""}
                {r.buyRate > 0 ? ` · Buy ${formatCurrency(r.buyRate)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
