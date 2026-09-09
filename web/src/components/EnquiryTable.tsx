"use client";

import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
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
  onViewPrint,
  metricModes,
  visibleColumns,
}: {
  rows: EnquiryRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onViewPrint?: (row: EnquiryRecord) => void;
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
            <SwipeEnquiryRow
              key={row.id}
              selected={selectedId === row.original.id}
              onSelect={() => onSelect(row.original.id)}
              onViewPrint={() => onViewPrint?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </SwipeEnquiryRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EDGE = 56;
const OPEN = 120;

function SwipeEnquiryRow({
  children,
  selected,
  onSelect,
  onViewPrint,
}: {
  children: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  onViewPrint: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const edge = useRef<"left" | "right" | null>(null);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLTableRowElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < EDGE) edge.current = "left";
    else if (x > rect.width - EDGE) edge.current = "right";
    else edge.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLTableRowElement>) {
    if (!edge.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!dragging.current) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        edge.current = null;
        return;
      }
      dragging.current = true;
    }
    if (edge.current === "left") setOffset(Math.max(0, Math.min(OPEN, dx)));
    if (edge.current === "right") setOffset(Math.min(0, Math.max(-OPEN, dx)));
  }

  function onPointerUp() {
    if (!dragging.current) {
      setRevealed(null);
      setOffset(0);
      onSelect();
      edge.current = null;
      return;
    }
    if (offset > 48) {
      setRevealed("left");
      setOffset(OPEN);
    } else if (offset < -48) {
      setRevealed("right");
      setOffset(-OPEN);
    } else {
      setRevealed(null);
      setOffset(0);
    }
    dragging.current = false;
    edge.current = null;
  }

  return (
    <>
      <tr
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-slate-50/80 ${
          selected ? "bg-sky-50" : ""
        }`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, touchAction: "pan-y" }}
      >
        {children}
      </tr>
      {revealed ? (
        <tr className="bg-[var(--color-atlas-navy)] text-white">
          <td colSpan={20} className="px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-xs font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewPrint();
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                View / Print
              </button>
              <button
                type="button"
                className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                  setRevealed(null);
                  setOffset(0);
                }}
              >
                More actions
              </button>
              <span className="text-[11px] text-white/70">
                Swipe the row ends to reveal · View opens as overlay
              </span>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
