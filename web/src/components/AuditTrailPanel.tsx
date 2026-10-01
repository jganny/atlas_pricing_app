"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { fetchAuditLog, type AuditRecord } from "@/lib/firebase/audit-log";
import { deskDisplayName } from "@/lib/quotes/team-roles";
import type { AuditAction } from "@/lib/audit/audit-entry";

const ACTION_LABEL: Record<AuditAction, string> = {
  "lead.create": "Lead created",
  "lead.update": "Lead edited",
  "lead.status": "Lead stage changed",
  "account.create": "Account created",
  "account.update": "Account edited",
  "account.delete": "Account deleted",
  "contact.add": "Contact added",
  "contact.delete": "Contact removed",
  "target.save": "Target set",
  "target.delete": "Target deleted",
  "territory.add": "Territory added",
  "territory.delete": "Territory deleted",
  "quote.save": "Quote saved",
  "quote.update": "Quote updated",
  "quote.delete": "Quote deleted",
  "seat.assign": "Desk seat reassigned",
  "seat.reset": "Desk seat reset",
};

const DESTRUCTIVE = new Set<AuditAction>(["account.delete", "contact.delete", "target.delete", "territory.delete", "quote.delete"]);

function csvEsc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: AuditRecord[]): string {
  const head = ["When", "Who", "Role", "Action", "Item", "Details", "Version"];
  const lines = rows.map((r) =>
    [r.atIso, r.actor, r.actorRole, ACTION_LABEL[r.action] || r.action, r.entityLabel, r.summary, r.version].map((x) => csvEsc(String(x ?? ""))).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

/** Admin-only, read-only history of who changed what. Entries can't be edited or deleted (see firestore.rules). */
export function AuditTrailPanel() {
  const { data = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["auditLog"],
    queryFn: () => fetchAuditLog(400),
    staleTime: 30_000,
    retry: 0,
  });
  const [text, setText] = useState("");
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");

  const actors = useMemo(() => [...new Set(data.map((r) => r.actor))].sort(), [data]);
  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return data.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (actor !== "all" && r.actor !== actor) return false;
      return !q || `${r.entityLabel} ${r.summary} ${r.actor}`.toLowerCase().includes(q);
    });
  }, [data, text, action, actor]);

  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card data-testid="audit-trail">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">Audit trail</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Who changed what, and when — leads, accounts, targets, territories and quotes made in this app. Newest first, last 400 entries. Read-only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={download} disabled={!rows.length}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input aria-label="Search audit trail" className="mt-0 w-56" placeholder="Search item, details, person…" value={text} onChange={(e) => setText(e.target.value)} />
        <Select aria-label="Filter by action" className="mt-0 w-48" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">All actions</option>
          {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by person" className="mt-0 w-44" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="all">Everyone</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {deskDisplayName(a)}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          The audit trail couldn&apos;t be loaded. It is admin-only and needs its database rule deployed — {error instanceof Error ? error.message : "permission denied"}.
        </p>
      ) : null}

      <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-[var(--color-border)]" role="region" aria-label="Audit trail entries" tabIndex={0}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                  {data.length ? "No entries match these filters." : "No activity recorded yet."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-1.5 text-xs">{r.atIso ? new Date(r.atIso).toLocaleString() : "—"}</td>
                  <td className="px-3 py-1.5">{deskDisplayName(r.actor)}</td>
                  <td className="px-3 py-1.5">
                    <Badge tone={DESTRUCTIVE.has(r.action) ? "error" : "neutral"}>{ACTION_LABEL[r.action] || r.action}</Badge>
                  </td>
                  <td className="px-3 py-1.5 font-semibold">{r.entityLabel || r.entityId}</td>
                  <td className="px-3 py-1.5 text-xs">{r.summary || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
