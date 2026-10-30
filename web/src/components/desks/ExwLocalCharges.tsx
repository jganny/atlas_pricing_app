"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ship } from "lucide-react";
import { Button } from "@/components/ui";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  EXW_SOURCE,
  buildExwRows,
  exwSheetsForOrigin,
  exwValidity,
  isExwRow,
  type ContainerCount,
  type Stuffing,
} from "@/lib/pricing/exw-sea-charges";
import type { SurchargeRow } from "@/lib/pricing/surcharges";
import { cn } from "@/lib/utils";

const STUFFING_LABEL: Record<Stuffing, string> = { factory: "Factory stuffing", cfs: "CFS / ICD stuffing" };

/**
 * Sea export on EXW terms: the local charges from the agents' sheet for the origin port fill in by themselves, for the
 * containers on the quote. Pick factory or CFS/ICD stuffing here. Typed rows are never overwritten; changing the port,
 * stuffing or containers refills only the rows this card put there.
 */
export function ExwLocalCharges({
  origin,
  module,
  incoterm,
  seaMode,
  currency,
  containers,
  rows,
  setRows,
  onUseUsd,
}: {
  origin: string;
  module: "export" | "import";
  incoterm: string;
  seaMode: string;
  currency: string;
  containers: ContainerCount[];
  rows: SurchargeRow[];
  setRows: (next: SurchargeRow[]) => void;
  onUseUsd: () => void;
}) {
  const sheets = useMemo(() => exwSheetsForOrigin(origin), [origin]);
  const [stuffing, setStuffing] = useState<Stuffing>("factory");
  const [routeIdx, setRouteIdx] = useState(0);
  const forStuffing = sheets.filter((s) => s.stuffing === stuffing);
  const sheet = forStuffing[Math.min(routeIdx, Math.max(0, forStuffing.length - 1))];
  const active = module === "export" && incoterm.toUpperCase() === "EXW" && seaMode === "fcl" && sheets.length > 0 && Boolean(sheet);
  const usd = currency === "USD";
  const containersKey = containers.map((c) => `${c.type}:${c.qty}`).join(",");
  const fillKey = active && usd && sheet ? `${sheet.id}|${containersKey}` : "";

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const current = rowsRef.current;
    const mine = current.filter(isExwRow);
    if (!fillKey || !sheet) {
      // No longer an EXW export (or not in USD): take back only the rows this card added.
      lastKey.current = "";
      if (mine.length) setRows(current.filter((r) => !isExwRow(r)));
      return;
    }
    // A saved quote or draft was opened with its EXW rows: leave them exactly as saved.
    if (lastKey.current === null && mine.length) {
      lastKey.current = fillKey;
      return;
    }
    // The desk typed its own charges: do not overwrite them. The Replace button below offers the sheet instead.
    if (current.length > mine.length) return;
    lastKey.current = fillKey;
    setRows(buildExwRows(sheet, containers));
    // containers and sheet are captured through fillKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillKey]);

  if (!(module === "export" && incoterm.toUpperCase() === "EXW" && seaMode === "fcl" && sheets.length > 0)) return null;

  const kinds = (["factory", "cfs"] as Stuffing[]).filter((k) => sheets.some((s) => s.stuffing === k));
  const validity = sheet ? exwValidity(sheet) : null;
  const mine = rows.filter(isExwRow);
  const typedRows = rows.length - mine.length;

  return (
    <div className="space-y-2 rounded-xl border border-sky-300 bg-sky-50/70 p-3" data-testid="exw-local-charges">
      <div className="flex flex-wrap items-center gap-2">
        <Ship className="h-4 w-4 text-sky-800" />
        <div className="text-sm font-bold text-sky-950">EXW export charges{sheet ? ` · ${sheet.place}` : ""}</div>
        {kinds.length === 2 ? (
          <ToggleSwitch
            className="ml-auto"
            data-testid="exw-stuffing-switch"
            leftLabel="Factory stuffing"
            rightLabel="CFS / ICD stuffing"
            checked={stuffing === "cfs"}
            onChange={(cfs) => {
              setStuffing(cfs ? "cfs" : "factory");
              setRouteIdx(0);
            }}
          />
        ) : (
          <span className="ml-auto text-xs font-bold text-sky-900">{STUFFING_LABEL[kinds[0]]}</span>
        )}
      </div>

      {forStuffing.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-sky-950">
          <span className="font-semibold">Route to port</span>
          {forStuffing.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={i === routeIdx}
              onClick={() => setRouteIdx(i)}
              className={cn("rounded-md border px-2 py-0.5 font-semibold", i === routeIdx ? "border-sky-700 bg-sky-700 text-white" : "border-sky-300 bg-white")}
            >
              {s.route}
            </button>
          ))}
        </div>
      ) : sheet?.route ? (
        <div className="text-xs text-sky-950">Route to port: {sheet.route}</div>
      ) : null}

      {!usd ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-sky-950">
          <span>These charges are in USD. This quote is in {currency}.</span>
          <Button type="button" size="sm" variant="secondary" onClick={onUseUsd}>
            Quote in USD and fill
          </Button>
        </div>
      ) : (
        <p className="text-sm text-sky-950" data-testid="exw-status">
          {mine.length
            ? `${mine.length} charges filled below from the agent's sheet, for ${containers.map((c) => `${c.qty} × ${c.type}`).join(" + ") || "your containers"}. Edit any amount; changing the port, stuffing or containers refills them.`
            : typedRows
              ? "You already have local charges typed below, so I left them alone."
              : "Charges fill in once the containers are entered."}
        </p>
      )}

      {usd && typedRows > 0 && sheet ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => setRows(buildExwRows(sheet, containers))}>
          Replace my {typedRows} typed charge{typedRows === 1 ? "" : "s"} with the EXW sheet
        </Button>
      ) : null}

      {validity ? (
        <p
          className={cn("text-xs font-semibold", validity.state === "valid" ? "text-emerald-800" : validity.state === "expired" ? "text-red-700" : "text-amber-800")}
          data-testid="exw-validity"
        >
          {validity.state === "valid"
            ? `Sheet valid to ${validity.text}.`
            : validity.state === "expired"
              ? `This sheet's rates ran to ${validity.text}. Check with the agent before you send.`
              : `${validity.text}. Check the rates are current before you send.`}
        </p>
      ) : null}

      {sheet && sheet.notes.length ? (
        <details className="text-xs text-sky-950">
          <summary className="cursor-pointer font-semibold">Agent&apos;s notes ({sheet.notes.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {sheet.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="text-[11px] text-sky-900/80">Source: {EXW_SOURCE}. Amounts fill as both Sell and Buy; add your margin on Sell.</div>
    </div>
  );
}
