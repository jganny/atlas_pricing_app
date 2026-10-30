"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui";
import { ModeChip, StatusChip } from "@/components/Chips";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { cn } from "@/lib/utils";
import type { EnquiryRecord } from "@/lib/types";
import {
  formatBuyCell,
  formatDateCell,
  formatGpCell,
  formatSellCell,
  formatTonnageCell,
  parseRowDate,
  type EdbMetricModes,
} from "@/lib/quotes/edb-metrics";

/** Rows drawn at a time in the Enquiry DB table. */
const PAGE_ROWS = 150;

function slaTone(hours: number) {
  if (hours > 8) return "error" as const;
  if (hours > 4) return "warn" as const;
  return "success" as const;
}

export type EdbColumnVisibility = {
  lane: boolean;
  desk: boolean;
  buy?: boolean;
  amount: boolean;
  gp: boolean;
  sla: boolean;
  tonnage?: boolean;
};

function moneyCellClass(empty: boolean, gp = false) {
  return cn(
    "whitespace-nowrap tabular-nums",
    empty ? "text-slate-400" : gp ? "font-semibold text-emerald-700" : undefined,
  );
}

export function EnquiryTable({
  rows,
  selectedId,
  onSelect,
  metricModes,
  visibleColumns,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  wonToggle,
}: {
  rows: EnquiryRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  metricModes: EdbMetricModes;
  visibleColumns?: EdbColumnVisibility;
  /** Lets a parent (e.g. a "Sort by" dropdown) drive the same sort state that
   * column-header clicks use, so both stay in sync and CSV export can mirror
   * it. Falls back to internal state when the caller doesn't need that. */
  sorting?: SortingState;
  onSortingChange?: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  /** One-tap Won on quotes the viewer may switch (see lib/quotes/won-actions). Leave out to hide the column. */
  wonToggle?: { canToggle: (row: EnquiryRecord) => boolean; onToggle: (row: EnquiryRecord, on: boolean) => void; busyId: string | null };
}) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([{ id: "ref", desc: true }]);
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = controlledOnSortingChange ?? setInternalSorting;
  const vis = visibleColumns ?? {
    lane: true,
    desk: true,
    buy: false,
    amount: true,
    gp: true,
    sla: true,
    tonnage: false,
  };
  const showBuy = Boolean(vis.buy);

  const columns = useMemo<ColumnDef<EnquiryRecord>[]>(
    () => {
      const defs: ColumnDef<EnquiryRecord>[] = [
        {
          accessorKey: "ref",
          header: "Ref",
          cell: ({ row }) => (
            <span className="whitespace-nowrap font-semibold">{row.original.ref}</span>
          ),
        },
        {
          id: "date",
          header: "Date",
          accessorFn: (r) => parseRowDate(r.createdAt),
          cell: ({ row }) => (
            <span className="whitespace-nowrap text-[var(--color-text-muted)]">{formatDateCell(row.original)}</span>
          ),
        },
        {
          accessorKey: "customer",
          header: "Customer",
          cell: ({ row }) => (
            <div className="min-w-0 max-w-[260px]">
              <div className="truncate whitespace-nowrap" title={row.original.customer || undefined}>{row.original.customer || "—"}</div>
              {row.original.carrier ? (
                <div className="whitespace-nowrap text-[11px] text-[var(--color-text-muted)]">
                  {row.original.carrier}
                </div>
              ) : null}
            </div>
          ),
        },
        {
          accessorKey: "mode",
          header: "Mode",
          cell: ({ getValue }) => <ModeChip mode={String(getValue())} />,
        },
      ];
      // Status and the Won switch sit right after Ref and Date, so they are always on screen without scrolling sideways.
      defs.splice(2, 0, {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      });
      if (wonToggle) {
        defs.splice(3, 0, {
          id: "won",
          header: "Won",
          enableSorting: false,
          cell: ({ row }) => {
            const r = row.original;
            if (!wonToggle.canToggle(r)) return <span className="text-slate-300">—</span>;
            return (
              <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <ToggleSwitch
                  label={`Mark ${r.customer || r.ref} as Won`}
                  checked={r.status === "won"}
                  disabled={wonToggle.busyId === r.id}
                  onChange={(on) => wonToggle.onToggle(r, on)}
                  data-testid="won-switch"
                />
              </span>
            );
          },
        });
      }
      if (vis.lane) {
        defs.push({
          id: "lane",
          header: "Lane",
          accessorFn: (r) =>
            r.destination ? `${r.origin} → ${r.destination}` : r.origin || "—",
          cell: ({ getValue }) => (
            <span className="block max-w-[240px] truncate whitespace-nowrap" title={String(getValue())}>{String(getValue())}</span>
          ),
        });
      }
      if (vis.desk) {
        defs.push({
          accessorKey: "assignee",
          header: "Desk",
          cell: ({ getValue }) => (
            <span className="whitespace-nowrap">{String(getValue() ?? "—")}</span>
          ),
        });
      }
      if (vis.tonnage) {
        defs.push({
          id: "tonnage",
          header: "Tonnage",
          accessorFn: (r) => r.billingWeight ?? 0,
          cell: ({ row }) => (
            <span className="whitespace-nowrap tabular-nums">{formatTonnageCell(row.original)}</span>
          ),
        });
      }
      if (vis.sla) {
        defs.push({
          accessorKey: "slaHoursOpen",
          header: "SLA",
          cell: ({ row }) => {
            const r = row.original;
            if (r.status !== "open" && r.status !== "quoted") return "—";
            return <Badge tone={slaTone(r.slaHoursOpen)}>{r.slaHoursOpen}h open</Badge>;
          },
        });
      }
      if (vis.amount) {
        if (showBuy) {
          defs.push({
            id: "buy",
            header: metricModes.buy === "perkg" ? "Buy /kg" : "Buy",
            accessorFn: (r) => r.buyTotal ?? r.grandTotal ?? 0,
            cell: ({ row }) => {
              const text = formatBuyCell(row.original, metricModes.buy);
              return <span className={moneyCellClass(text === "—")}>{text}</span>;
            },
          });
        }
        defs.push({
          id: "sell",
          header: metricModes.sell === "perkg" ? "Sell /kg" : "Sell",
          accessorFn: (r) => r.grandTotal ?? 0,
          cell: ({ row }) => {
            const text = formatSellCell(row.original, metricModes.sell);
            return <span className={moneyCellClass(text === "—")}>{text}</span>;
          },
        });
      }
      if (vis.gp) {
        defs.push({
          id: "gp",
          header: metricModes.gp === "percent" ? "GP %" : "GP",
          accessorFn: (r) => r.grossProfit ?? 0,
          cell: ({ row }) => {
            const text = formatGpCell(row.original, metricModes.gp);
            return <span className={moneyCellClass(text === "—", true)}>{text}</span>;
          },
        });
      }
      return defs;
    },
    [metricModes, showBuy, vis.amount, vis.desk, vis.gp, vis.lane, vis.sla, vis.tonnage, wonToggle],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Draw a page of rows at a time: all ~1,200 at once is ~25,000 page elements and freezes the screen on open.
  const [limit, setLimit] = useState(PAGE_ROWS);
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setLimit(PAGE_ROWS);
  }
  const sortedRows = table.getRowModel().rows;
  const selectedAt = selectedId ? sortedRows.findIndex((r) => r.original.id === selectedId) : -1;
  const shownCount = Math.min(sortedRows.length, Math.max(limit, selectedAt + 1));
  const shownRows = sortedRows.slice(0, shownCount);

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-[var(--color-text-muted)]">No enquiries match your filters.</p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="edb-table-scroll">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const id = header.column.id;
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 font-bold",
                      (id === "sell" || id === "gp" || id === "buy" || id === "tonnage") && "text-right",
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold uppercase"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {shownRows.map((row) => {
            const selected = selectedId === row.original.id;
            return (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                data-testid="edb-row-scroll"
                className={cn(
                  "cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/80",
                  selected ? "bg-sky-50" : "bg-white",
                )}
                onClick={() => onSelect(row.original.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(row.original.id);
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const id = cell.column.id;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        (id === "sell" || id === "gp" || id === "buy" || id === "tonnage") && "text-right",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {shownCount < sortedRows.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)]" data-testid="edb-more">
          <span>
            Showing {shownCount.toLocaleString()} of {sortedRows.length.toLocaleString()} quotes. Search or filter to narrow them down.
          </span>
          <span className="flex gap-2">
            <button type="button" className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 font-bold text-[var(--color-atlas-navy)] hover:bg-slate-50" onClick={() => setLimit(shownCount + PAGE_ROWS)}>
              Show {PAGE_ROWS} more
            </button>
            <button type="button" className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 font-semibold hover:bg-slate-50" onClick={() => setLimit(sortedRows.length)}>
              Show all
            </button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
