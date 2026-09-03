"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeleton";
import { EnquiryInspector } from "@/components/EnquiryInspector";
import { EnquiryTable } from "@/components/EnquiryTable";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useLiveData } from "@/lib/api";
import type { EnquiryRecord } from "@/lib/types";

const PIPELINE_CHIPS: Array<{ key: string; label: string; match: (e: EnquiryRecord) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "quoted", label: "Quoted", match: (e) => e.status === "quoted" || e.status === "open" },
  { key: "won", label: "Won", match: (e) => e.status === "won" },
  { key: "lost", label: "Lost", match: (e) => e.status === "lost" },
  { key: "cancelled", label: "Cancelled", match: (e) => e.status === "cancelled" },
];

export default function EnquiryDatabasePage() {
  const { data: rows = [], isLoading, error, refetch } = useEnquiries();
  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const chip of PIPELINE_CHIPS) {
      counts[chip.key] = rows.filter(chip.match).length;
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const chip = PIPELINE_CHIPS.find((c) => c.key === pipeline) ?? PIPELINE_CHIPS[0];
    return rows.filter((row) => {
      if (!chip.match(row)) return false;
      if (modeFilter !== "all" && row.mode !== modeFilter) return false;
      if (!q) return true;
      const hay = `${row.ref} ${row.customer} ${row.origin} ${row.destination} ${row.assignee}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, pipeline, modeFilter]);

  const selected = filtered.find((r) => r.id === selectedId) ?? rows.find((r) => r.id === selectedId) ?? null;

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
              ? "Live pipeline — sortable TanStack Table · click a row for lifecycle actions."
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

      <div className="flex flex-wrap gap-2">
        {PIPELINE_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setPipeline(chip.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              pipeline === chip.key
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-slate-50"
            }`}
          >
            {chip.label} <span className="opacity-80">({pipelineCounts[chip.key] ?? 0})</span>
          </button>
        ))}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
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
              <TableSkeleton rows={8} />
            ) : (
              <EnquiryTable
                rows={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </Card>
        </div>

        <div>
          {selected ? (
            <EnquiryInspector row={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <Card className="text-sm text-[var(--color-text-muted)]">
              Select a row to view details, print, amend, or update status.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
