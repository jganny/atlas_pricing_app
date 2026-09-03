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

export function EnquiryTable({
  rows,
  selectedId,
  onSelect,
  metricModes,
}: {
  rows: EnquiryRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  metricModes: EdbMetricModes;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "ref", desc: true }]);

  const columns = useMemo<ColumnDef<EnquiryRecord>[]>(
    () => [
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
      {
        id: "lane",
        header: "Lane",
        accessorFn: (r) => `${r.origin} → ${r.destination}`,
      },
      {
        accessorKey: "assignee",
        header: "Desk",
      },
      {
        accessorKey: "carrier",
        header: "Carrier",
        cell: ({ row }) => row.original.carrier || "—",
      },
      {
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
      },
      {
        accessorKey: "slaHoursOpen",
        header: "SLA",
        cell: ({ row }) => {
          const r = row.original;
          if (r.status !== "open" && r.status !== "quoted") return "—";
          return <Badge tone={slaTone(r.slaHoursOpen)}>{r.slaHoursOpen}h open</Badge>;
        },
      },
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
      {
        id: "gp",
        header: metricModes.gp === "percent" ? "GP %" : "GP",
        accessorFn: (r) => r.grossProfit ?? 0,
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-emerald-700">
            {formatGpCell(row.original, metricModes.gp)}
          </span>
        ),
      },
    ],
    [metricModes],
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
