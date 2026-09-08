"use client";

import type { WeightBreakName } from "@atlas/pricing-core";
import { Badge, Input, Label, NumberInput } from "@/components/ui";
import { CarrierCombobox } from "@/components/CarrierCombobox";
import { SurchargeTable } from "@/components/desks/SurchargeTable";
import { ValidityField } from "@/components/ValidityField";
import type { AirlineTotals } from "@/lib/pricing/air-desk";
import { visibleAirBreaks } from "@/lib/pricing/air-desk";
import type { AirlineOption } from "@/lib/pricing/carrier-options";
import { formatRoutingPreview, formatTransitPreview, normalizeRouting } from "@/lib/pricing/terms";
import { formatCurrency } from "@/lib/utils";

const BREAK_LABELS: Record<WeightBreakName, string> = {
  min: "Minimum",
  minus45: "−45 kg",
  plus45: "+45 kg",
  plus100: "+100 kg",
  plus300: "+300 kg",
  plus500: "+500 kg",
  plus1000: "+1000 kg",
};

export function AirlineOptionForm({
  opt,
  tot,
  currency,
  showAllBreaks,
  onToggleAllBreaks,
  lastDestTabTarget,
  onUpdate,
  onUpdateBreak,
}: {
  opt: AirlineOption;
  tot: AirlineTotals | undefined;
  currency: string;
  showAllBreaks: boolean;
  onToggleAllBreaks: () => void;
  lastDestTabTarget?: string;
  onUpdate: (patch: Partial<AirlineOption>) => void;
  onUpdateBreak: (name: WeightBreakName, field: "sell" | "buy", value: number) => void;
}) {
  const amsId = `air-ams-fee-${opt.id}`;
  const chw = tot?.freight.chargeableWeightKg ?? 0;
  const breaksToShow = visibleAirBreaks(chw, tot?.freight.usedBreak, showAllBreaks);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <CarrierCombobox
            label="Carrier / Airline"
            value={opt.name}
            onChange={(v) => onUpdate({ name: v })}
            kind="airline"
            placeholder="EK, Emirates, QR…"
          />
        </div>
        <div>
          <Label>Routing</Label>
          <Input
            value={opt.routing}
            autoComplete="off"
            name={`atlas-air-routing-${opt.id}`}
            onChange={(e) => onUpdate({ routing: e.target.value })}
            onBlur={() => onUpdate({ routing: normalizeRouting(opt.routing) })}
            placeholder="BLR-DXB-LHR"
          />
          {opt.routing.trim() ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Preview: {formatRoutingPreview(opt.routing)}
            </p>
          ) : null}
        </div>
        <div>
          <Label>Transit time</Label>
          <Input
            value={opt.tt}
            autoComplete="off"
            onChange={(e) => onUpdate({ tt: e.target.value })}
            placeholder="3-4"
          />
          {opt.tt.trim() ? (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Preview: {formatTransitPreview(opt.tt)}
            </p>
          ) : null}
        </div>
        <ValidityField value={opt.validity} onChange={(v) => onUpdate({ validity: v })} />
        <Label>
          Pivot weight (kg)
          <NumberInput
            value={opt.pivotWeightKg || 0}
            onValueChange={(n) => onUpdate({ pivotWeightKg: n })}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                document.getElementById(amsId)?.focus();
              }
            }}
          />
        </Label>
        <div className="md:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              id={amsId}
              type="checkbox"
              checked={opt.amsFeeEnabled}
              onChange={(e) => onUpdate({ amsFeeEnabled: e.target.checked })}
            />
            AMS fee
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Label>
              AMS sell
              <NumberInput
                disabled={!opt.amsFeeEnabled}
                step="0.01"
                value={opt.amsFee}
                onValueChange={(n) => onUpdate({ amsFee: n })}
              />
            </Label>
            <Label>
              AMS buy
              <NumberInput
                disabled={!opt.amsFeeEnabled}
                step="0.01"
                value={opt.amsFeeBuy || 0}
                onValueChange={(n) => onUpdate({ amsFeeBuy: n })}
              />
            </Label>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={opt.wbEnabled}
          onChange={(e) => onUpdate({ wbEnabled: e.target.checked })}
        />
        Weight-break tariffs included
      </label>

      {opt.wbEnabled ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-text-muted)]">
              {chw > 0 && !showAllBreaks
                ? `Showing the ${BREAK_LABELS[breaksToShow[0] ?? "plus500"]} break for ${chw.toFixed(0)} kg chargeable.`
                : "Enter Sell (customer) and/or Buy (cost). Quote total uses Sell when set; if Sell is blank it uses Buy."}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 hover:underline"
              onClick={onToggleAllBreaks}
            >
              {showAllBreaks ? "Show active break only" : "Show all breaks"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Break</th>
                  <th className="px-3 py-2">Sell (customer)</th>
                  <th className="px-3 py-2">Buy (cost)</th>
                </tr>
              </thead>
              <tbody>
                {breaksToShow.map((name) => (
                  <tr
                    key={name}
                    className={`border-t ${tot?.freight.usedBreak === name ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-semibold">
                      {BREAK_LABELS[name]}
                      {tot?.freight.usedBreak === name ? <Badge tone="warn">Active</Badge> : null}
                    </td>
                    <td className="p-1">
                      <NumberInput
                        step="0.01"
                        className="mt-0 w-24 px-2 py-1"
                        value={opt.breaks[name]?.sell ?? 0}
                        onValueChange={(n) => onUpdateBreak(name, "sell", n)}
                      />
                    </td>
                    <td className="p-1">
                      <NumberInput
                        step="0.01"
                        className="mt-0 w-24 px-2 py-1"
                        value={opt.breaks[name]?.buy ?? 0}
                        onValueChange={(n) => onUpdateBreak(name, "buy", n)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tot && tot.baseFreightQuote > 0 ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Freight: {tot.freight.chargeableWeightKg.toFixed(2)} kg × $
              {(
                (tot.freight.activeRate > 0
                  ? tot.freight.activeRate
                  : tot.freight.activeBuyRate) || 0
              ).toFixed(2)}
              {tot.quoteUsingBuyFreight ? " (from Buy)" : ""} ={" "}
              <strong>{formatCurrency(tot.baseFreightQuote, currency)}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      <SurchargeTable
        title="Origin local fees & surcharges"
        enabled={opt.originFeesEnabled}
        onEnabledChange={(v) => onUpdate({ originFeesEnabled: v })}
        rows={opt.originSurcharges}
        onChange={(rows) => onUpdate({ originSurcharges: rows })}
        units={["kg", "flat"]}
      />
      <SurchargeTable
        title="Destination local fees & surcharges"
        enabled={opt.destFeesEnabled}
        onEnabledChange={(v) => onUpdate({ destFeesEnabled: v })}
        rows={opt.destSurcharges}
        onChange={(rows) => onUpdate({ destSurcharges: rows })}
        units={["kg", "flat"]}
        lastFieldTabTarget={lastDestTabTarget}
      />

      {tot ? (
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <span>
              Freight: <strong>{formatCurrency(tot.baseFreightQuote, currency)}</strong>
            </span>
            <span>
              Origin: <strong>{formatCurrency(tot.originTotal, currency)}</strong>
            </span>
            <span>
              Dest: <strong>{formatCurrency(tot.destTotal, currency)}</strong>
            </span>
            {tot.ams > 0 ? (
              <span>
                AMS: <strong>{formatCurrency(tot.ams, currency)}</strong>
              </span>
            ) : null}
            <span>
              Quote total:{" "}
              <strong className="text-emerald-700">{formatCurrency(tot.grandSell, currency)}</strong>
            </span>
          </div>
          {tot.gpReady ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              GP {formatCurrency(tot.gp, currency)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AirlineEditorOverlay({
  title,
  children,
  onDone,
}: {
  title: string;
  children: React.ReactNode;
  onDone: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
    >
      <div className="mb-8 w-full max-w-3xl rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">{title}</h2>
          <button
            type="button"
            data-modal-close
            className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-sm font-semibold"
            onClick={onDone}
          >
            Done
          </button>
        </div>
        {children}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white"
            onClick={onDone}
          >
            Save option
          </button>
        </div>
      </div>
    </div>
  );
}