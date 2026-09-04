"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, Download, Loader2, Search } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeleton";
import { EnquiryInspector } from "@/components/EnquiryInspector";
import { EnquiryTable } from "@/components/EnquiryTable";
import { toast } from "@/components/Toast";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { lookupQuoteByRef } from "@/lib/firebase/archive-lookup";
import {
  downloadEnquiryCsv,
  summarizeEnquiryFinancials,
} from "@/lib/quotes/edb-csv";
import {
  DEFAULT_EDB_METRIC_MODES,
  type EdbMetricModes,
} from "@/lib/quotes/edb-metrics";
import {
  isAdminUser,
  listDeskFilterOptions,
  matchesDeskFilter,
} from "@/lib/quotes/team-roles";
import type { EnquiryRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const PIPELINE_CHIPS: Array<{ key: string; label: string; match: (e: EnquiryRecord) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "quoted", label: "Quoted", match: (e) => e.status === "quoted" || e.status === "open" },
  { key: "won", label: "Won", match: (e) => e.status === "won" },
  { key: "lost", label: "Lost", match: (e) => e.status === "lost" },
  { key: "cancelled", label: "Cancelled", match: (e) => e.status === "cancelled" },
];

function MetricToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2 py-1 font-semibold ${
              value === opt.value
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EnquiryDatabaseInner() {
  const searchParams = useSearchParams();
  const { data: rows = [], isLoading, error, refetch } = useEnquiries();
  const user = useAuthStore((s) => s.user);
  const admin = isAdminUser(user?.username, user?.role);

  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [pipeline, setPipeline] = useState("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [deskFilter, setDeskFilter] = useState<string>(admin ? "all" : "mine");
  const [originFilter, setOriginFilter] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [columns, setColumns] = useState({
    lane: true,
    desk: true,
    carrier: true,
    amount: true,
    gp: true,
    sla: true,
  });
  const [showColumns, setShowColumns] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams?.get("select") ?? null);
  const [metricModes, setMetricModes] = useState<EdbMetricModes>(DEFAULT_EDB_METRIC_MODES);
  const [archiveHit, setArchiveHit] = useState<EnquiryRecord | null>(null);
  const [archiveRef, setArchiveRef] = useState("");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveNote, setArchiveNote] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams?.get("q");
    const sel = searchParams?.get("select");
    if (q) setSearch(q);
    if (sel) setSelectedId(sel);
  }, [searchParams]);

  useEffect(() => {
    if (!admin && deskFilter === "all") setDeskFilter("mine");
  }, [admin, deskFilter]);

  const deskOptions = useMemo(
    () => listDeskFilterOptions(rows.map((r) => r.creator).filter(Boolean)),
    [rows],
  );

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
    const username = (user?.username || "").toLowerCase();
    return rows.filter((row) => {
      if (row.creator === "mahendra") return false;
      if (!chip.match(row)) return false;
      if (modeFilter !== "all" && row.mode !== modeFilter) return false;
      if (originFilter && !row.origin.toLowerCase().includes(originFilter.toLowerCase())) return false;
      if (destFilter && !row.destination.toLowerCase().includes(destFilter.toLowerCase())) return false;
      if (
        carrierFilter &&
        !(row.carrier || "").toLowerCase().includes(carrierFilter.toLowerCase())
      ) {
        return false;
      }
      if (deskFilter === "mine") {
        if (row.creator !== username && row.assignee.toLowerCase() !== username) return false;
      } else if (!matchesDeskFilter(row.creator, deskFilter)) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${row.ref} ${row.customer} ${row.origin} ${row.destination} ${row.assignee} ${row.creator} ${row.carrier || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, pipeline, modeFilter, deskFilter, user?.username, originFilter, destFilter, carrierFilter]);

  const selected =
    filtered.find((r) => r.id === selectedId) ??
    rows.find((r) => r.id === selectedId) ??
    (archiveHit && archiveHit.id === selectedId ? archiveHit : null);

  const stats = useMemo(() => {
    const open = filtered.filter((e) => e.status === "open" || e.status === "quoted").length;
    const overdue = filtered.filter((e) => e.slaHoursOpen > 8).length;
    const fin = summarizeEnquiryFinancials(filtered);
    return { open, overdue, total: filtered.length, ...fin };
  }, [filtered]);

  async function findArchived() {
    const ref = archiveRef.trim();
    if (!ref) {
      toast("Enter a quote ref or ID", "error");
      return;
    }
    if (!useLiveData) {
      const hit = rows.find(
        (r) =>
          r.ref.toLowerCase().includes(ref.toLowerCase()) ||
          r.id.toLowerCase() === ref.toLowerCase(),
      );
      if (hit) {
        setSelectedId(hit.id);
        setSearch(hit.ref);
        setArchiveNote("Found in mock list");
        toast(`Found ${hit.ref}`, "success");
      } else {
        setArchiveNote("Not found in mock data");
        toast("Not found", "error");
      }
      return;
    }
    setArchiveBusy(true);
    setArchiveNote(null);
    try {
      const hit = await lookupQuoteByRef(ref);
      if (!hit) {
        setArchiveNote("No live or archived quote matched that ref.");
        toast("Quote not found in live or archive", "error");
        return;
      }
      setSelectedId(hit.row.id);
      setSearch(hit.row.ref);
      setArchiveHit(hit.row);
      setArchiveNote(
        hit.source === "archive"
          ? `Found in archive_quotes · ${hit.row.ref}`
          : `Found in live quotes · ${hit.row.ref}`,
      );
      toast(
        hit.source === "archive" ? `Archived quote ${hit.row.ref}` : `Live quote ${hit.row.ref}`,
        "success",
      );
      // Ensure row is visible even if not in current page of live list
      if (!rows.some((r) => r.id === hit.row.id)) {
        setPipeline("all");
        setModeFilter("all");
        setDeskFilter(admin ? "all" : "mine");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Lookup failed", "error");
    } finally {
      setArchiveBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Enquiry database</h1>
            <Badge tone="info">Phase 9</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Buy / Sell / GP modes · desk ownership · CSV · find archived quotes.
            {useLiveData ? " Live Firestore sync." : " Mock data."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!filtered.length}
            onClick={() => {
              downloadEnquiryCsv(filtered);
              toast(`Exported ${filtered.length} rows`, "success");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Showing</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Open in view</div>
          <div className="text-2xl font-bold text-amber-600">{stats.open}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Overdue</div>
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Sell (view)</div>
          <div className="text-lg font-bold tabular-nums">
            {formatCurrency(stats.revenue, "USD")}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">GP (view)</div>
          <div className="text-lg font-bold tabular-nums text-emerald-700">
            {formatCurrency(stats.gp, "USD")}
          </div>
        </Card>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">Could not load enquiries.</p>
        </Card>
      ) : null}

      <Card className="flex flex-wrap items-center gap-4 p-4">
        <MetricToggle
          label="Buy"
          value={metricModes.buy}
          options={[
            { value: "total", label: "Total" },
            { value: "perkg", label: "Per kg" },
          ]}
          onChange={(buy) => setMetricModes((m) => ({ ...m, buy }))}
        />
        <MetricToggle
          label="Sell"
          value={metricModes.sell}
          options={[
            { value: "total", label: "Total" },
            { value: "perkg", label: "Per kg" },
          ]}
          onChange={(sell) => setMetricModes((m) => ({ ...m, sell }))}
        />
        <MetricToggle
          label="GP"
          value={metricModes.gp}
          options={[
            { value: "amount", label: "Amount" },
            { value: "percent", label: "%" },
          ]}
          onChange={(gp) => setMetricModes((m) => ({ ...m, gp }))}
        />
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-atlas-navy)]">
          <Archive className="h-4 w-4" />
          Find old / archived quote
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            placeholder="Paste ref ID or quote number…"
            value={archiveRef}
            onChange={(e) => setArchiveRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void findArchived();
            }}
          />
          <Button type="button" disabled={archiveBusy} onClick={() => void findArchived()}>
            {archiveBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Look up
          </Button>
        </div>
        {archiveNote ? (
          <p className="text-xs font-semibold text-[var(--color-text-muted)]">{archiveNote}</p>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            Searches live quotes, then archive_quotes (90-day archive storage).
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="flex flex-wrap gap-3 p-4">
            <label className="flex min-w-[200px] flex-1 items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
              <input
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
                placeholder="Search ref, customer, lane, carrier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
            >
              <option value="all">All modes</option>
              <option value="air">Air</option>
              <option value="sea">Sea</option>
              <option value="courier">Courier</option>
              <option value="transport">Transport</option>
              <option value="warehouse">Warehouse</option>
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={deskFilter}
              onChange={(e) => setDeskFilter(e.target.value)}
            >
              {admin ? <option value="all">All desks</option> : null}
              <option value="mine">My desk</option>
              {deskOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              className="w-24 rounded-lg border px-2 py-2 text-sm"
              placeholder="POL"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
            />
            <input
              className="w-24 rounded-lg border px-2 py-2 text-sm"
              placeholder="POD"
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
            />
            <input
              className="w-28 rounded-lg border px-2 py-2 text-sm"
              placeholder="Carrier"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
            />
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-xs font-bold"
              onClick={() => setShowColumns((v) => !v)}
            >
              Columns
            </button>
          </Card>
          {showColumns ? (
            <Card className="flex flex-wrap gap-3 p-3 text-xs font-semibold">
              {(
                [
                  ["lane", "Lane"],
                  ["desk", "Desk"],
                  ["carrier", "Carrier"],
                  ["amount", "Amount"],
                  ["gp", "GP"],
                  ["sla", "SLA"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={columns[key]}
                    onChange={(e) =>
                      setColumns((c) => ({ ...c, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </Card>
          ) : null}

          <Card className="overflow-x-auto p-0">
            {isLoading ? (
              <TableSkeleton rows={8} />
            ) : (
              <EnquiryTable
                rows={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                metricModes={metricModes}
                visibleColumns={columns}
              />
            )}
          </Card>
        </div>

        <div>
          {selected ? (
            <EnquiryInspector row={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <Card className="text-sm text-[var(--color-text-muted)]">
              Select a row to view details, print, amend, or update status. Press ⌘K to find quotes by
              ref or customer.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EnquiryDatabasePage() {
  return (
    <Suspense
      fallback={
        <Card className="p-6 text-sm text-[var(--color-text-muted)]">Loading enquiry database…</Card>
      }
    >
      <EnquiryDatabaseInner />
    </Suspense>
  );
}
