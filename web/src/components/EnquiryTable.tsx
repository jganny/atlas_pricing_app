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

function slaTone(hours: number) {
  if (hours > 8) return "error" as const;
  if (hours > 4) return "warn" as const;
  return "success" as const;
}

export type EdbColumnVisibility = {
  lane: boolean;
  desk: boolean;
  carrier: boolean;
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
}) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([{ id: "ref", desc: true }]);
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = controlledOnSortingChange ?? setInternalSorting;
  const vis = visibleColumns ?? {
    lane: true,
    desk: true,
    carrier: true,
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
          cell: ({ getValue }) => (
            <span className="whitespace-nowrap">{String(getValue() ?? "—")}</span>
          ),
        },
        {
          accessorKey: "mode",
          header: "Mode",
          cell: ({ getValue }) => (
            <span className="uppercase">{String(getValue())}</span>
          ),
        },
      ];
      if (vis.lane) {
        defs.push({
          id: "lane",
          header: "Lane",
          accessorFn: (r) =>
            r.destination ? `${r.origin} → ${r.destination}` : r.origin || "—",
          cell: ({ getValue }) => (
            <span className="whitespace-nowrap">{String(getValue())}</span>
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
      if (vis.carrier) {
        defs.push({
          accessorKey: "carrier",
          header: "Carrier",
          cell: ({ row }) => (
            <span className="whitespace-nowrap">{row.original.carrier || "—"}</span>
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
      defs.push({
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              tone={
                status === "open" || status === "quoted"
                  ? "warn"
                  : status === "won"
                    ? "success"
                    : "neutral"
              }
            >
              {status}
            </Badge>
          );
        },
      });
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
    [metricModes, showBuy, vis.amount, vis.carrier, vis.desk, vis.gp, vis.lane, vis.sla, vis.tonnage],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
          {table.getRowModel().rows.map((row) => {
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
    </div>
  );
}
