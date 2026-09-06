"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Save } from "lucide-react";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import {
  listNrsFollowUps,
  updateNrsFollowUp,
  type NrsFollowUp,
} from "@/lib/quotes/nrs-alerts";
import { formatCurrency } from "@/lib/utils";

export default function NrsFollowUpsPage() {
  const [rows, setRows] = useState<NrsFollowUp[]>([]);
  const [editing, setEditing] = useState<Record<string, Partial<NrsFollowUp>>>({});

  function reload() {
    setRows(listNrsFollowUps());
  }

  useEffect(() => {
    reload();
  }, []);

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const complete = useMemo(() => rows.filter((r) => r.status === "complete"), [rows]);

  function draft(id: string): NrsFollowUp {
    const base = rows.find((r) => r.id === id)!;
    return { ...base, ...(editing[id] || {}) } as NrsFollowUp;
  }

  function patch(id: string, next: Partial<NrsFollowUp>) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));
  }

  function saveRow(id: string) {
    const d = draft(id);
    updateNrsFollowUp(id, {
      shipper: d.shipper,
      consignee: d.consignee,
      commodity: d.commodity,
      notes: d.notes,
      followUpDate: d.followUpDate,
    });
    setEditing((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    reload();
    toast("Follow-up saved", "success");
  }

  function markComplete(id: string) {
    const d = draft(id);
    updateNrsFollowUp(id, {
      shipper: d.shipper,
      consignee: d.consignee,
      commodity: d.commodity,
      notes: d.notes,
      followUpDate: d.followUpDate,
      status: "complete",
    });
    setEditing((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    reload();
    toast("Marked complete", "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
          NRS follow-ups
        </h1>
        <Badge tone="info">{pending.length} pending</Badge>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Fill shipper / consignee / commodity after a quote is won. Stored locally for Cathrina
        until ops sync is wired.
      </p>

      {pending.length === 0 ? (
        <Card className="text-sm text-[var(--color-text-muted)]">No pending follow-ups.</Card>
      ) : (
        <div className="space-y-3">
          {pending.map((row) => {
            const d = draft(row.id);
            return (
              <Card key={row.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-[var(--color-atlas-navy)]">
                      {d.ref} · {d.customer}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Buy {formatCurrency(d.buyRate)} · Sell {formatCurrency(d.sellRate)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => saveRow(row.id)}>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button type="button" size="sm" onClick={() => markComplete(row.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Shipper</Label>
                    <Input
                      value={d.shipper}
                      onChange={(e) => patch(row.id, { shipper: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Consignee</Label>
                    <Input
                      value={d.consignee}
                      onChange={(e) => patch(row.id, { consignee: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Commodity</Label>
                    <Input
                      value={d.commodity}
                      onChange={(e) => patch(row.id, { commodity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Follow-up date</Label>
                    <Input
                      type="date"
                      value={d.followUpDate}
                      onChange={(e) => patch(row.id, { followUpDate: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={d.notes}
                      onChange={(e) => patch(row.id, { notes: e.target.value })}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {complete.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase text-[var(--color-text-muted)]">
            Completed
          </h2>
          <ul className="space-y-1 text-sm">
            {complete.slice(0, 20).map((r) => (
              <li key={r.id} className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
                <span className="font-semibold">{r.ref}</span> · {r.customer}
                {r.shipper ? ` · ${r.shipper}` : ""}
                {r.consignee ? ` → ${r.consignee}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
