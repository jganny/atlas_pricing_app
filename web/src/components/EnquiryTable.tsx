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
  formatGpCell,
  formatSellCell,
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
  amount: boolean;
  gp: boolean;
  sla: boolean;
};

export function EnquiryTable({
  rows,
  selectedId,
  onSelect,
  onViewPrint,
  onDelete,
  metricModes,
  visibleColumns,
}: {
  rows: EnquiryRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onViewPrint?: (row: EnquiryRecord) => void;
  onDelete?: (row: EnquiryRecord) => void;
  metricModes: EdbMetricModes;
  visibleColumns?: EdbColumnVisibility;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "ref", desc: true }]);
  const vis = visibleColumns ?? {
    lane: true,
    desk: true,
    carrier: true,
    amount: true,
    gp: true,
    sla: true,
  };

  const columns = useMemo<ColumnDef<EnquiryRecord>[]>(
    () => {
      const defs: ColumnDef<EnquiryRecord>[] = [
        {
          accessorKey: "ref",
          header: "Ref",
          cell: ({ row }) => <span className="font-semibold">{row.original.ref}</span>,
        },
        {
          accessorKey: "customer",
          header: "Customer",
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
        });
      }
      if (vis.desk) {
        defs.push({
          accessorKey: "assignee",
          header: "Desk",
        });
      }
      if (vis.carrier) {
        defs.push({
          accessorKey: "carrier",
          header: "Carrier",
          cell: ({ row }) => row.original.carrier || "—",
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
        defs.push(
          {
            id: "buy",
            header: metricModes.buy === "perkg" ? "Buy /kg" : "Buy",
            accessorFn: (r) => r.buyTotal ?? r.grandTotal ?? 0,
            cell: ({ row }) => (
              <span className="tabular-nums">{formatBuyCell(row.original, metricModes.buy)}</span>
            ),
          },
          {
            id: "sell",
            header: metricModes.sell === "perkg" ? "Sell /kg" : "Sell",
            accessorFn: (r) => r.grandTotal ?? 0,
            cell: ({ row }) => (
              <span className="tabular-nums">{formatSellCell(row.original, metricModes.sell)}</span>
            ),
          },
        );
      }
      if (vis.gp) {
        defs.push({
          id: "gp",
          header: metricModes.gp === "percent" ? "GP %" : "GP",
          accessorFn: (r) => r.grossProfit ?? 0,
          cell: ({ row }) => (
            <span className="tabular-nums font-semibold text-emerald-700">
              {formatGpCell(row.original, metricModes.gp)}
            </span>
          ),
        });
      }
      return defs;
    },
    [metricModes, vis.amount, vis.carrier, vis.desk, vis.gp, vis.lane, vis.sla],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const leafCount = Math.max(1, table.getVisibleLeafColumns().length);
  const template = onDelete
    ? `repeat(${leafCount}, minmax(7.5rem, 1fr)) 5.5rem`
    : `repeat(${leafCount}, minmax(7.5rem, 1fr))`;

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-[var(--color-text-muted)]">No enquiries match your filters.</p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="edb-table-scroll">
      <div className="border-b border-[var(--color-border)] bg-slate-50 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        {table.getHeaderGroups().map((hg) => (
          <div key={hg.id} className="grid items-center" style={{ gridTemplateColumns: template }}>
            {hg.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <div key={header.id} className="whitespace-nowrap px-3 py-3">
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
                </div>
              );
            })}
            {onDelete ? <div className="sticky right-0 bg-slate-50 px-3 py-3 text-right"> </div> : null}
          </div>
        ))}
      </div>
      <div>
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            data-testid="edb-row-scroll"
            className={cn(
              "grid cursor-pointer items-center border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/80",
              selectedId === row.original.id ? "bg-sky-50" : "bg-white",
            )}
            style={{ gridTemplateColumns: template }}
            onClick={() => onSelect(row.original.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(row.original.id);
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id} className="whitespace-nowrap px-3 py-3">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
            {onDelete ? (
              <div className="sticky right-0 flex justify-end bg-inherit px-1 py-1">
                <button
                  type="button"
                  data-testid="edb-row-delete"
                  className="rounded-md bg-red-600 px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-white hover:bg-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(row.original);
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {onDelete ? (
        <p className="border-t border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
          Scroll the row left to right if columns overflow — Delete stays at the far right and
          removes the saved quote.
        </p>
      ) : null}
    </div>
  );
}
