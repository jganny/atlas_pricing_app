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
  metricModes,
  visibleColumns,
}: {
  rows: EnquiryRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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
          accessorFn: (r) => `${r.origin} → ${r.destination}`,
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

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-[var(--color-text-muted)]">No enquiries match your filters.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id} className="whitespace-nowrap px-3 py-3">
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
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row.original.id)}
              className={`cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/80 ${
                selectedId === row.original.id ? "bg-sky-50" : ""
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
