"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useLiveData } from "@/lib/api";
import type { EnquiryRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

function slaTone(hours: number) {
  if (hours > 8) return "error" as const;
  if (hours > 4) return "warn" as const;
  return "success" as const;
}

export default function EnquiryDatabasePage() {
  const { data: rows = [], isLoading, error, refetch } = useEnquiries();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (modeFilter !== "all" && row.mode !== modeFilter) return false;
      if (!q) return true;
      const hay = `${row.ref} ${row.customer} ${row.origin} ${row.destination} ${row.assignee}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, modeFilter]);

  const stats = useMemo(() => {
    const open = filtered.filter((e) => e.status === "open" || e.status === "quoted").length;
    const overdue = filtered.filter((e) => e.slaHoursOpen > 8).length;
    return { open, overdue, total: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Enquiry database</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {useLiveData
              ? "Live quotes from Firestore — search and filter."
              : "Mock pipeline view with SLA tracking."}
          </p>
        </div>
        {useLiveData ? (
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
          >
            Refresh
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><div className="text-xs text-[var(--color-text-muted)]">Showing</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card><div className="text-xs text-[var(--color-text-muted)]">Open in view</div><div className="text-2xl font-bold text-amber-600">{stats.open}</div></Card>
        <Card><div className="text-xs text-[var(--color-text-muted)]">Overdue in view</div><div className="text-2xl font-bold text-red-600">{stats.overdue}</div></Card>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">Could not load enquiries.</p>
        </Card>
      ) : null}

      <Card className="flex flex-wrap gap-3 p-4">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 text-sm font-semibold">
          <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            placeholder="Search ref, customer, lane…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select className="rounded-lg border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="quoted">Quoted</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="all">All modes</option>
          <option value="air">Air</option>
          <option value="sea">Sea</option>
          <option value="courier">Courier</option>
          <option value="transport">Transport</option>
          <option value="warehouse">Warehouse</option>
        </select>
      </Card>

      <Card className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading enquiries…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-text-muted)]">No enquiries match your filters.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Lane</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row: EnquiryRecord) => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold">{row.ref}</td>
                  <td className="px-4 py-3">{row.customer}</td>
                  <td className="px-4 py-3 uppercase">{row.mode}</td>
                  <td className="px-4 py-3">
                    {row.origin} → {row.destination}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        row.status === "open" || row.status === "quoted"
                          ? "warn"
                          : row.status === "won"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "open" || row.status === "quoted" ? (
                      <Badge tone={slaTone(row.slaHoursOpen)}>{row.slaHoursOpen}h open</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {row.grandTotal ? formatCurrency(row.grandTotal, row.currency) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
