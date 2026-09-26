"use client";

import { ReportBuilderPanel } from "@/components/ReportBuilderPanel";
import { GuideTipButton } from "@/components/GuideTipButton";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SortingState } from "@tanstack/react-table";
import { Archive, Columns3, Download, Loader2, Search } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { TableSkeleton } from "@/components/Skeleton";
import { EnquiryInspector } from "@/components/EnquiryInspector";
import { EnquiryTable } from "@/components/EnquiryTable";
import { toast } from "@/components/Toast";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { lookupQuoteByRef, lookupQuotesByText } from "@/lib/firebase/archive-lookup";
import type { EnquiryRecord } from "@/lib/types";
import {
  downloadEnquiryCsv,
  summarizeEnquiryFinancials,
} from "@/lib/quotes/edb-csv";
import { searchQuotes } from "@/lib/quotes/find-quotes";
import {
  getLastSavedEnquiry,
  isDeletedQuoteId,
  listLocalEnquiries,
  mergeLocalEnquiries,
} from "@/lib/quotes/local-enquiries";
import {
  archiveOlderThan,
  buildFyReportCards,
  listLocalArchive,
} from "@/lib/quotes/edb-reports";
import {
  DEFAULT_EDB_METRIC_MODES,
  gpNumeric,
  type EdbMetricModes,
} from "@/lib/quotes/edb-metrics";
import {
  isAdminUser,
  listDeskFilterOptions,
  matchesDeskFilter,
} from "@/lib/quotes/team-roles";
import { formatCurrency } from "@/lib/utils";

const PIPELINE_CHIPS: Array<{ key: string; label: string; match: (e: EnquiryRecord) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "quoted", label: "Quoted", match: (e) => e.status === "quoted" || e.status === "open" },
  { key: "won", label: "Won", match: (e) => e.status === "won" },
  { key: "lost", label: "Lost", match: (e) => e.status === "lost" },
  { key: "cancelled", label: "Cancelled", match: (e) => e.status === "cancelled" },
];

/** "Sort by" presets — the same sort state column-header clicks use, so
 * picking one here and then clicking a header afterward never fights. */
const SORT_PRESETS: Array<{ key: string; label: string; sorting: SortingState }> = [
  { key: "ref_desc", label: "Newest first", sorting: [{ id: "ref", desc: true }] },
  { key: "tonnage_desc", label: "Tonnage: high → low", sorting: [{ id: "tonnage", desc: true }] },
  { key: "tonnage_asc", label: "Tonnage: low → high", sorting: [{ id: "tonnage", desc: false }] },
  { key: "sell_desc", label: "Billing: high → low", sorting: [{ id: "sell", desc: true }] },
  { key: "sell_asc", label: "Billing: low → high", sorting: [{ id: "sell", desc: false }] },
  { key: "gp_desc", label: "GP: high → low", sorting: [{ id: "gp", desc: true }] },
  { key: "gp_asc", label: "GP: low → high", sorting: [{ id: "gp", desc: false }] },
];

/** Mirrors the table's own per-column sort for CSV export, which never runs
 * through react-table — keeps "extract the data" always matching what the
 * screen shows for the metrics the Sort-by control actually offers. */
function sortKeyFor(row: EnquiryRecord, id: string): number | string {
  switch (id) {
    case "tonnage":
      return row.billingWeight ?? 0;
    case "sell":
      return row.grandTotal ?? 0;
    case "gp":
      return gpNumeric(row) ?? 0;
    case "customer":
      return (row.customer || "").toLowerCase();
    default:
      return row.ref || row.id;
  }
}

function sortRowsForExport(rows: EnquiryRecord[], sorting: SortingState): EnquiryRecord[] {
  const rule = sorting[0];
  if (!rule) return rows;
  const dir = rule.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = sortKeyFor(a, rule.id);
    const vb = sortKeyFor(b, rule.id);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

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
    <div className="flex items-center gap-1 text-[11px]">
      <span className="font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <div className="inline-flex rounded-md border border-[var(--color-border)] bg-white p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded px-1.5 py-0.5 font-semibold ${
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
  const { data: liveRows = [], isLoading, error } = useEnquiries();
  const rows = useMemo(() => mergeLocalEnquiries(liveRows), [liveRows]);
  const user = useAuthStore((s) => s.user);
  const admin = isAdminUser(user?.username, user?.role);

  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [pipeline, setPipeline] = useState(searchParams?.get("pipeline") || "all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [deskFilter, setDeskFilter] = useState<string>(admin ? "all" : "mine");
  const [originFilter, setOriginFilter] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tonnageMin, setTonnageMin] = useState("");
  const [tonnageMax, setTonnageMax] = useState("");
  const [sortKey, setSortKey] = useState<string>("ref_desc");
  const [sorting, setSorting] = useState<SortingState>(SORT_PRESETS[0].sorting);
  const [columns, setColumns] = useState({
    lane: true,
    desk: false,
    carrier: false,
    buy: false,
    amount: true,
    gp: true,
    sla: false,
    tonnage: false,
  });
  const [showColumns, setShowColumns] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams?.get("select") ?? null);
  const [metricModes, setMetricModes] = useState<EdbMetricModes>(DEFAULT_EDB_METRIC_MODES);
  const [archiveHit, setArchiveHit] = useState<EnquiryRecord | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveNote, setArchiveNote] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams?.get("q");
    const sel = searchParams?.get("select");
    const pipe = searchParams?.get("pipeline");
    if (pipe && PIPELINE_CHIPS.some((c) => c.key === pipe)) setPipeline(pipe);
    if (q) setSearch(q);
    if (sel) {
      setSelectedId(sel);
      return;
    }
    if (q) return;
    const last = getLastSavedEnquiry();
    if (last && !isDeletedQuoteId(last.id)) {
      setSelectedId(last.id);
      setSearch(last.ref);
    }
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
    const out = rows.filter((row) => {
      if (row.creator === "mahendra") return false;
      if (selectedId && !isDeletedQuoteId(selectedId) && row.id === selectedId) return true;
      if (!chip.match(row)) return false;
      if (modeFilter !== "all" && row.mode !== modeFilter) return false;
      if (originFilter && !row.origin.toLowerCase().includes(originFilter.toLowerCase())) return false;
      if (destFilter) {
        const destHay = `${row.destination} ${row.origin}`.toLowerCase();
        if (!destHay.includes(destFilter.toLowerCase())) return false;
      }
      if (
        carrierFilter &&
        !(row.carrier || "").toLowerCase().includes(carrierFilter.toLowerCase())
      ) {
        return false;
      }
      if (customerFilter && !(row.customer || "").toLowerCase().includes(customerFilter.toLowerCase())) {
        return false;
      }
      if (dateFrom || dateTo) {
        const rowTime = Date.parse(row.createdAt) || Number(row.createdAt) || 0;
        if (dateFrom && rowTime < Date.parse(dateFrom)) return false;
        if (dateTo && rowTime > Date.parse(`${dateTo}T23:59:59`)) return false;
      }
      if (tonnageMin || tonnageMax) {
        const weight = row.billingWeight;
        if (weight == null) return false;
        if (tonnageMin && weight < Number(tonnageMin)) return false;
        if (tonnageMax && weight > Number(tonnageMax)) return false;
      }
      if (deskFilter === "mine") {
        const creator = (row.creator || "").toLowerCase();
        const assignee = (row.assignee || "").toLowerCase();
        const mine =
          !username ||
          creator === username ||
          assignee === username ||
          assignee.includes(username) ||
          creator.includes(username);
        if (!mine) return false;
      } else if (!matchesDeskFilter(row.creator, deskFilter)) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${row.ref} ${row.customer} ${row.origin} ${row.destination} ${row.assignee} ${row.creator} ${row.carrier || ""}`.toLowerCase();
      return hay.includes(q);
    });
    if (selectedId && !isDeletedQuoteId(selectedId) && !out.some((r) => r.id === selectedId)) {
      const pinned =
        rows.find((r) => r.id === selectedId && !isDeletedQuoteId(r.id)) ??
        listLocalEnquiries().find((r) => r.id === selectedId) ??
        (archiveHit?.id === selectedId ? archiveHit : null);
      if (pinned) return [pinned, ...out];
    }
    return out;
  }, [
    rows,
    search,
    pipeline,
    modeFilter,
    deskFilter,
    user?.username,
    originFilter,
    destFilter,
    carrierFilter,
    customerFilter,
    dateFrom,
    dateTo,
    tonnageMin,
    tonnageMax,
    selectedId,
    archiveHit,
  ]);

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

  const fyCards = useMemo(() => buildFyReportCards(filtered), [filtered]);

  async function findArchived() {
    const q = search.trim();
    if (!q) {
      toast("Type a customer, city, carrier, or quote number", "error");
      return;
    }
    const localHits = searchQuotes([...listLocalArchive(), ...rows], q, 8);
    const pick = (hit: EnquiryRecord, note: string) => {
      setSelectedId(hit.id);
      setSearch(hit.customer || hit.ref);
      setArchiveHit(hit);
      setArchiveNote(note);
      toast(`Opened ${hit.ref} · ${hit.customer}`, "success");
    };
    if (!useLiveData) {
      if (localHits[0]) pick(localHits[0], "Found without the file name");
      else {
        setArchiveNote("Nothing matched that customer or lane in mock data");
        toast("Not found", "error");
      }
      return;
    }
    if (localHits[0]) {
      pick(localHits[0], `Matched ${localHits[0].customer} · ${localHits[0].ref}`);
      return;
    }
    setArchiveBusy(true);
    setArchiveNote(null);
    try {
      const hits = await lookupQuotesByText(q);
      const hit = hits[0] ?? null;
      if (!hit) {
        const byRef = await lookupQuoteByRef(q);
        if (!byRef) {
          setArchiveNote("No live or archived quote matched. Try the customer name or a city.");
          toast("Quote not found", "error");
          return;
        }
        pick(
          byRef.row,
          byRef.source === "archive" ? `Archived · ${byRef.row.ref}` : `Live · ${byRef.row.ref}`,
        );
        return;
      }
      pick(
        hit.row,
        hit.source === "archive"
          ? `Archived · ${hit.row.customer} · ${hit.row.ref}`
          : `Live · ${hit.row.customer} · ${hit.row.ref}`,
      );
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Enquiry DB</h1>
          <div className="flex flex-wrap gap-1">
            {PIPELINE_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setPipeline(chip.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  pipeline === chip.key
                    ? "bg-[var(--color-atlas-navy)] text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-slate-50"
                }`}
              >
                {chip.label} ({pipelineCounts[chip.key] ?? 0})
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowReports((v) => !v)}
          >
            {showReports ? "Hide FY" : "FY report"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="report-builder-toggle"
            onClick={() => setShowBuilder((v) => !v)}
          >
            {showBuilder ? "Hide report builder" : "Report builder"}
          </Button>
          <GuideTipButton query="report builder" />
          {admin ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const { archived } = archiveOlderThan(rows, 90);
                toast(
                  archived.length
                    ? `Archived ${archived.length} quotes older than 90 days (local)`
                    : "No quotes older than 90 days to archive",
                  "success",
                );
              }}
            >
              <Archive className="mr-1 h-3.5 w-3.5" />
              90-day archive
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!filtered.length}
            onClick={() => {
              downloadEnquiryCsv(sortRowsForExport(filtered, sorting));
              toast(`Exported ${filtered.length} rows`, "success");
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm sm:grid-cols-5"
        data-testid="edb-kpi-strip"
      >
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">In view</div>
          <div className="text-lg font-extrabold tabular-nums">{stats.total}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Open</div>
          <div className="text-lg font-extrabold tabular-nums text-amber-600">{stats.open}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Overdue</div>
          <div className="text-lg font-extrabold tabular-nums text-red-600">{stats.overdue}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Sell (INR)</div>
          <div className="text-sm font-extrabold tabular-nums">{formatCurrency(stats.revenue, "INR")}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">GP (INR)</div>
          <div className="text-sm font-extrabold tabular-nums text-emerald-700">
            {formatCurrency(stats.gp, "INR")}
          </div>
        </div>
      </div>

      {showReports ? (
        <div className="grid gap-2 sm:grid-cols-5">
          {fyCards.map((b) => (
            <Card key={b.id} className="py-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                {b.label}
              </div>
              <div className="mt-0.5 text-sm font-extrabold tabular-nums">
                {formatCurrency(b.sell, "INR")}
              </div>
              <div className="text-[11px] text-emerald-700">
                GP {formatCurrency(b.gp, "INR")} · {b.count}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {showBuilder ? <ReportBuilderPanel rows={filtered} /> : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">Could not load enquiries.</p>
        </Card>
      ) : null}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-2">
          <Card className="flex flex-wrap items-center gap-2 p-2.5">
            <label className="flex min-w-[16rem] flex-1 items-center gap-2 text-sm">
              <Search className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <input
                className="w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5"
                placeholder="Customer, city, carrier, or quote no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void findArchived();
                }}
              />
            </label>
            <Button type="button" size="sm" disabled={archiveBusy} onClick={() => void findArchived()}>
              {archiveBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Look up
            </Button>
            <select
              aria-label="Filter by mode"
              className="rounded-md border px-2 py-1.5 text-sm"
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
              aria-label="Filter by desk"
              className="rounded-md border px-2 py-1.5 text-sm"
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
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
              placeholder="POL"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
            />
            <input
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
              placeholder="POD"
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
            />
            <input
              className="w-24 rounded-md border px-2 py-1.5 text-sm"
              placeholder="Carrier"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
            />
            <input
              className="w-28 rounded-md border px-2 py-1.5 text-sm"
              placeholder="Customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
            <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
              From
              <input
                type="date"
                aria-label="Date from"
                className="rounded-md border px-2 py-1.5 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
              To
              <input
                type="date"
                aria-label="Date to"
                className="rounded-md border px-2 py-1.5 text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <input
              type="number"
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
              placeholder="Tonnage ≥"
              aria-label="Minimum tonnage"
              value={tonnageMin}
              onChange={(e) => setTonnageMin(e.target.value)}
            />
            <input
              type="number"
              className="w-20 rounded-md border px-2 py-1.5 text-sm"
              placeholder="Tonnage ≤"
              aria-label="Maximum tonnage"
              value={tonnageMax}
              onChange={(e) => setTonnageMax(e.target.value)}
            />
            <select
              aria-label="Sort by"
              className="rounded-md border px-2 py-1.5 text-sm"
              value={sortKey}
              onChange={(e) => {
                const key = e.target.value;
                setSortKey(key);
                const preset = SORT_PRESETS.find((p) => p.key === key);
                if (preset) setSorting(preset.sorting);
              }}
            >
              {SORT_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  Sort: {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-bold"
              onClick={() => setShowColumns((v) => !v)}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>
            <MetricToggle
              label="Buy"
              value={metricModes.buy}
              options={[
                { value: "total", label: "Total" },
                { value: "perkg", label: "/kg" },
              ]}
              onChange={(buy) => setMetricModes((m) => ({ ...m, buy }))}
            />
            <MetricToggle
              label="Sell"
              value={metricModes.sell}
              options={[
                { value: "total", label: "Total" },
                { value: "perkg", label: "/kg" },
              ]}
              onChange={(sell) => setMetricModes((m) => ({ ...m, sell }))}
            />
            <MetricToggle
              label="GP"
              value={metricModes.gp}
              options={[
                { value: "amount", label: "Amt" },
                { value: "percent", label: "%" },
              ]}
              onChange={(gp) => setMetricModes((m) => ({ ...m, gp }))}
            />
          </Card>
          {archiveNote ? (
            <p className="px-1 text-[11px] font-semibold text-[var(--color-text-muted)]">{archiveNote}</p>
          ) : null}
          {showColumns ? (
            <Card className="flex flex-wrap gap-3 p-2 text-xs font-semibold">
              {(
                [
                  ["lane", "Lane"],
                  ["desk", "Desk"],
                  ["carrier", "Carrier"],
                  ["tonnage", "Tonnage"],
                  ["buy", "Buy"],
                  ["amount", "Sell"],
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

          <Card className="overflow-hidden p-0">
            {isLoading ? (
              <TableSkeleton rows={8} />
            ) : (
              <EnquiryTable
                rows={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                metricModes={metricModes}
                visibleColumns={columns}
                sorting={sorting}
                onSortingChange={setSorting}
              />
            )}
          </Card>
        </div>

        <div className="lg:sticky lg:top-16">
          {selected ? (
            <EnquiryInspector row={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <Card className="text-sm text-[var(--color-text-muted)]">
              Select a quote. Look up searches live quotes and archive — no file name needed.
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
