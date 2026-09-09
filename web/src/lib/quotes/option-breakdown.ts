import type { SeaMode } from "@atlas/pricing-core";
import type { SavedQuote } from "../types";
import type { AirlineOption, LinerOption } from "../pricing/carrier-options";
import {
  createAirlineOption,
  serializeAirlineOption,
  serializeLinerOption,
} from "../pricing/carrier-options";
import {
  computeAirlineTotals,
  type AirCargoRow,
} from "../pricing/air-desk";
import { computeLinerTotals } from "../pricing/sea-desk";
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
  gst: number;
  detention: number;
  tolls: number;
  storage: number;
  handling: number;
  freightSell: number;
};

type FeeFields = Omit<OptionBreakdown, keyof VendorPreviewRow>;

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

function shouldComputeAirline(kind: string, quoteType: string): boolean {
  const t = quoteType.toLowerCase();
  const k = kind.toLowerCase();
  if (t.includes("sea") || t.includes("courier") || t.includes("transport") || t.includes("warehouse")) {
    return false;
  }
  if (k === "liner" || k === "courier" || k === "trucker" || k === "warehouse") return false;
  return true;
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

/** Persistable liner / coloader snapshot — never runs air kg×rate math. */
export function linerSnapshot(
  liner: LinerOption,
  mode: SeaMode,
  grossWeightKg: number,
  volumeCbm: number,
  chargeableCbmOverride: number,
  lanes: QuoteLane[],
  fallbackLaneId: string,
): Record<string, unknown> {
  const t = computeLinerTotals(mode, grossWeightKg, volumeCbm, chargeableCbmOverride, liner);
  const laneIndex = Math.max(
    0,
    lanes.findIndex((l) => l.id === (liner.laneId || fallbackLaneId)),
  );
  const lane = lanes[laneIndex] ?? lanes[0];
  return {
    ...serializeLinerOption(liner),
    quoteTotal: t.grandSell,
    baseFreight: t.baseFreightQuote,
    originFeesTotal: t.originTotal,
    destFeesTotal: t.destTotal,
    quoteUsingBuyFreight: t.quoteUsingBuyFreight,
    chargeableRt: t.freight.chargeableRt,
    laneId: liner.laneId || fallbackLaneId,
    laneLabel: lane ? laneRouteLabel(lane, laneIndex) : "",
  };
}

export function courierSnapshot(
  q: {
    id: string;
    name: string;
    sellLocal: number;
    ratePerKg?: number;
    transit?: string;
  },
  selectedId: string,
  extra: { validity?: string; chargeableKg?: number; gstAmount?: number },
): Record<string, unknown> {
  const selected = q.id === selectedId;
  return {
    ...q,
    kind: "courier",
    quoteTotal: q.sellLocal,
    selected,
    tt: q.transit ?? "",
    appliedRate: q.ratePerKg ?? 0,
    baseFreight: q.sellLocal,
    chargeableWeight: extra.chargeableKg ?? 0,
    validity: extra.validity ?? "",
    gst: selected ? extra.gstAmount ?? 0 : 0,
  };
}

export function truckerSnapshot(
  t: {
    id: string;
    name: string;
    selected: boolean;
    freightBuy: number;
    freightSell: number;
    detention: number;
    tolls: number;
  },
  validity: string,
): Record<string, unknown> {
  const quoteTotal = t.freightSell + t.detention + t.tolls;
  return {
    id: t.id,
    name: t.name || "Untitled",
    kind: "trucker",
    selected: Boolean(t.selected),
    freightBuy: t.freightBuy,
    freightSell: t.freightSell,
    detention: t.detention,
    tolls: t.tolls,
    quoteTotal,
    baseFreight: t.freightSell,
    validity,
  };
}

function pick(stored: unknown, computedVal: number, fallback: number, selected: boolean): number {
  const n = num(stored);
  if (n > 0) return n;
  if (computedVal > 0) return computedVal;
  return selected ? fallback : 0;
}

function totalsFromRaw(
  raw: Record<string, unknown>,
  cargo: AirCargoRow[],
  selectedFallback: FeeFields,
  selected: boolean,
  kind: string,
  quoteType: string,
): FeeFields {
  const k = kind.toLowerCase();
  const computeAir = shouldComputeAirline(kind, quoteType);
  const computed =
    computeAir && (cargo.length || Array.isArray(raw.originSurcharges) || raw.breaks)
      ? computeAirlineTotals(cargo.length ? cargo : [{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }], asAirline(raw))
      : null;

  const freightSell = pick(raw.freightSell, 0, selectedFallback.freightSell, selected);
  const detention = pick(raw.detention, 0, selectedFallback.detention, selected);
  const tolls = pick(raw.tolls, 0, selectedFallback.tolls, selected);
  const storage = pick(raw.storage, 0, selectedFallback.storage, selected);
  const handling = pick(raw.handling, 0, selectedFallback.handling, selected);
  const gst = pick(raw.gst ?? raw.gstAmount, 0, selectedFallback.gst, selected);

  let baseFreight = pick(raw.baseFreight ?? raw.sellLocal, computed?.baseFreightQuote ?? 0, selectedFallback.baseFreight, selected);
  if (k === "trucker" && baseFreight <= 0) baseFreight = freightSell;
  if (k === "warehouse" && baseFreight <= 0) baseFreight = storage;

  return {
    baseFreight,
    originFees: pick(
      raw.originFeesTotal ?? raw.originTotal,
      computed?.originTotal ?? 0,
      selectedFallback.originFees,
      selected,
    ),
    destFees: pick(
      raw.destFeesTotal ?? raw.destTotal,
      computed?.destTotal ?? 0,
      selectedFallback.destFees,
      selected,
    ),
    ams: computeAir
      ? pick(raw.ams ?? raw.amsFee, computed?.ams ?? 0, selectedFallback.ams, selected)
      : 0,
    appliedRate: pick(
      raw.appliedRate ?? raw.ratePerKg,
      computed ? computed.freight.activeRate || computed.freight.activeBuyRate : 0,
      selectedFallback.appliedRate,
      selected,
    ),
    chargeableWeight:
      num(raw.chargeableWeight) ||
      computed?.freight.chargeableWeightKg ||
      (selected ? selectedFallback.chargeableWeight : 0),
    validity: String(raw.validity ?? (selected ? selectedFallback.validity : "") ?? ""),
    quoteUsingBuyFreight: Boolean(
      raw.quoteUsingBuyFreight ?? computed?.quoteUsingBuyFreight ?? (selected && selectedFallback.quoteUsingBuyFreight),
    ),
    gst,
    detention,
    tolls,
    storage,
    handling,
    freightSell,
  };
}

function rawOptions(d: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(d.airlines) && d.airlines.length) return d.airlines.map(rec);
  if (Array.isArray(d.liners) && d.liners.length) return d.liners.map(rec);
  if (Array.isArray(d.carrierQuotes) && d.carrierQuotes.length) return d.carrierQuotes.map(rec);
  if (Array.isArray(d.truckers) && d.truckers.length) return d.truckers.map(rec);
  return [];
}

/** Per-option breakup the client can inspect on screen and in the printed pack. */
export function optionBreakdownsFromQuote(quote: SavedQuote): OptionBreakdown[] {
  const d = (quote.details ?? {}) as Record<string, unknown>;
  const quoteType = String(quote.type || d.type || d.mode || "");
  const vendors = vendorRowsFromQuote(quote);
  const cargo = cargoFromDetails(d);
  const days = Math.max(1, num(d.days) || 1);
  const selectedFallback: FeeFields = {
    baseFreight: num(d.baseFreight),
    originFees: num(d.originFeesTotal),
    destFees: num(d.destFeesTotal),
    ams: num(d.amsFee ?? d.ams),
    appliedRate: num(d.appliedRate),
    chargeableWeight: num(d.chargeableWeight),
    validity: String(d.validity ?? ""),
    quoteUsingBuyFreight: Boolean(d.quoteUsingBuyFreight),
    gst: num(d.gstAmount ?? d.tax),
    detention: num(d.detention),
    tolls: num(d.tolls),
    storage: num(d.storage) || num(d.ratePerCbm) * num(d.cbm) * days,
    handling: num(d.handling),
    freightSell: num(d.freightSell),
  };
  const options = rawOptions(d);

  return vendors.map((v) => {
    const raw =
      options.find((o) => String(o.id ?? "") === v.id) ||
      options.find((o) => String(o.name ?? "").trim().toLowerCase() === v.name.trim().toLowerCase()) ||
      {};
    const fees = totalsFromRaw(raw, cargo, selectedFallback, v.selected, v.kind, quoteType);
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
