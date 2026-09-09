import type { SavedQuote } from "../types";
import type { AirlineOption } from "../pricing/carrier-options";
import { createAirlineOption, serializeAirlineOption } from "../pricing/carrier-options";
import {
  computeAirlineTotals,
  type AirCargoRow,
} from "../pricing/air-desk";
import { laneRouteLabel, type QuoteLane } from "./lanes";
import { vendorRowsFromQuote, type VendorPreviewRow } from "./vendor-preview";

export type OptionBreakdown = VendorPreviewRow & {
  baseFreight: number;
  originFees: number;
  destFees: number;
  ams: number;
  appliedRate: number;
  chargeableWeight: number;
  validity: string;
  quoteUsingBuyFreight: boolean;
};

function rec(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cargoFromDetails(d: Record<string, unknown>): AirCargoRow[] {
  const items = d.cargoItems;
  if (!Array.isArray(items) || !items.length) return [];
  return items.map((raw) => {
    const r = rec(raw);
    return {
      l: num(r.l),
      w: num(r.w),
      h: num(r.h),
      qty: Math.max(1, num(r.qty) || 1),
      gw: num(r.gw),
    };
  });
}

function asAirline(raw: Record<string, unknown>): AirlineOption {
  return createAirlineOption(
    {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      routing: String(raw.routing ?? ""),
      tt: String(raw.tt ?? ""),
      validity: String(raw.validity ?? ""),
      pivotWeightKg: num(raw.pivotWeightKg),
      amsFee: num(raw.amsFee),
      amsFeeBuy: num(raw.amsFeeBuy),
      amsFeeEnabled: raw.amsFeeEnabled !== false,
      laneId: String(raw.laneId ?? ""),
      kind: raw.kind === "coloader" ? "coloader" : "airline",
      wbEnabled: raw.wbEnabled !== false,
      originFeesEnabled: raw.originFeesEnabled !== false,
      destFeesEnabled: raw.destFeesEnabled !== false,
      breaks: (raw.breaks as AirlineOption["breaks"]) ?? undefined,
      originSurcharges: Array.isArray(raw.originSurcharges)
        ? (raw.originSurcharges as AirlineOption["originSurcharges"])
        : undefined,
      destSurcharges: Array.isArray(raw.destSurcharges)
        ? (raw.destSurcharges as AirlineOption["destSurcharges"])
        : undefined,
    },
    Boolean(raw.selected),
  );
}

/** Persistable per-option snapshot for preview, save, and the client quote pack. */
export function airlineSnapshot(
  a: AirlineOption,
  cargo: AirCargoRow[],
  lanes: QuoteLane[],
  fallbackLaneId: string,
): Record<string, unknown> {
  const t = computeAirlineTotals(cargo, a);
  const laneIndex = Math.max(
    0,
    lanes.findIndex((l) => l.id === (a.laneId || fallbackLaneId)),
  );
  const lane = lanes[laneIndex] ?? lanes[0];
  return {
    ...serializeAirlineOption(a),
    quoteTotal: t.grandSell,
    baseFreight: t.baseFreightQuote,
    originFeesTotal: t.originTotal,
    destFeesTotal: t.destTotal,
    ams: t.ams,
    appliedRate: t.freight.activeRate || t.freight.activeBuyRate || 0,
    chargeableWeight: t.freight.chargeableWeightKg,
    quoteUsingBuyFreight: t.quoteUsingBuyFreight,
    laneId: a.laneId || fallbackLaneId,
    laneLabel: lane ? laneRouteLabel(lane, laneIndex) : "",
  };
}

function totalsFromRaw(
  raw: Record<string, unknown>,
  cargo: AirCargoRow[],
  selectedFallback: {
    baseFreight: number;
    originFees: number;
    destFees: number;
    ams: number;
    appliedRate: number;
    chargeableWeight: number;
    validity: string;
    quoteUsingBuyFreight: boolean;
  },
  selected: boolean,
): Omit<
  OptionBreakdown,
  keyof VendorPreviewRow
> {
  const computed =
    cargo.length || Array.isArray(raw.originSurcharges) || raw.breaks
      ? computeAirlineTotals(cargo.length ? cargo : [{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }], asAirline(raw))
      : null;

  const pick = (stored: unknown, computedVal: number, fallback: number) => {
    const n = num(stored);
    if (n > 0) return n;
    if (computedVal > 0) return computedVal;
    return selected ? fallback : 0;
  };

  return {
    baseFreight: pick(raw.baseFreight, computed?.baseFreightQuote ?? 0, selectedFallback.baseFreight),
    originFees: pick(
      raw.originFeesTotal ?? raw.originTotal,
      computed?.originTotal ?? 0,
      selectedFallback.originFees,
    ),
    destFees: pick(
      raw.destFeesTotal ?? raw.destTotal,
      computed?.destTotal ?? 0,
      selectedFallback.destFees,
    ),
    ams: pick(raw.ams ?? raw.amsFee, computed?.ams ?? 0, selectedFallback.ams),
    appliedRate: pick(
      raw.appliedRate,
      computed ? computed.freight.activeRate || computed.freight.activeBuyRate : 0,
      selectedFallback.appliedRate,
    ),
    chargeableWeight:
      num(raw.chargeableWeight) ||
      computed?.freight.chargeableWeightKg ||
      selectedFallback.chargeableWeight,
    validity: String(raw.validity ?? (selected ? selectedFallback.validity : "") ?? ""),
    quoteUsingBuyFreight: Boolean(
      raw.quoteUsingBuyFreight ?? computed?.quoteUsingBuyFreight ?? (selected && selectedFallback.quoteUsingBuyFreight),
    ),
  };
}

function rawOptions(d: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(d.airlines) && d.airlines.length) return d.airlines.map(rec);
  if (Array.isArray(d.liners) && d.liners.length) return d.liners.map(rec);
  if (Array.isArray(d.carrierQuotes) && d.carrierQuotes.length) return d.carrierQuotes.map(rec);
  if (Array.isArray(d.truckers) && d.truckers.length) return d.truckers.map(rec);
  return [];
}

/** Per-airline / per-lane breakup the client can inspect on screen and in the printed pack. */
export function optionBreakdownsFromQuote(quote: SavedQuote): OptionBreakdown[] {
  const d = (quote.details ?? {}) as Record<string, unknown>;
  const vendors = vendorRowsFromQuote(quote);
  const cargo = cargoFromDetails(d);
  const selectedFallback = {
    baseFreight: num(d.baseFreight),
    originFees: num(d.originFeesTotal),
    destFees: num(d.destFeesTotal),
    ams: num(d.amsFee ?? d.ams),
    appliedRate: num(d.appliedRate),
    chargeableWeight: num(d.chargeableWeight),
    validity: String(d.validity ?? ""),
    quoteUsingBuyFreight: Boolean(d.quoteUsingBuyFreight),
  };
  const options = rawOptions(d);

  return vendors.map((v) => {
    const raw =
      options.find((o) => String(o.id ?? "") === v.id) ||
      options.find((o) => String(o.name ?? "").trim().toLowerCase() === v.name.trim().toLowerCase()) ||
      {};
    const fees = totalsFromRaw(raw, cargo, selectedFallback, v.selected);
    return {
      ...v,
      routing: v.routing || String(raw.routing ?? ""),
      tt: v.tt || String(raw.tt ?? raw.transit ?? ""),
      laneId: v.laneId || String(raw.laneId ?? ""),
      laneLabel: v.laneLabel || String(raw.laneLabel ?? ""),
      ...fees,
    };
  });
}
