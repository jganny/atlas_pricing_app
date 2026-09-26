import type { SeaMode } from "@atlas/pricing-core";
import type { SavedQuote } from "../types";
import { formatCurrency } from "../utils";
import type { AirlineOption, CourierOption, LinerOption } from "../pricing/carrier-options";
import {
  createAirlineOption,
  createLinerOption,
  serializeAirlineOption,
  serializeLinerOption,
} from "../pricing/carrier-options";
import {
  computeAirlineTotals,
  type AirCargoRow,
} from "../pricing/air-desk";
import { computeLinerTotals } from "../pricing/sea-desk";
import { quoteSideRate } from "../pricing/quote-rate";
import { laneRouteLabel, type QuoteLane } from "./lanes";
import { vendorRowsFromQuote, type VendorPreviewRow } from "./vendor-preview";

/** One named surcharge row's own quoted amount — e.g. "Origin THC" → 4500. */
export type SurchargeBreakdownLine = { name: string; amount: number };
/** One FCL container-type row's own quoted amount — e.g. 2 × 40'GP @ 500 → 1000. */
export type ContainerBreakdownLine = { type: string; qty: number; rate: number; amount: number };

export type OptionBreakdown = VendorPreviewRow & {
  baseFreight: number;
  originFees: number;
  destFees: number;
  ams: number;
  dg: number;
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
  /** Per-surcharge-row breakup — empty when the saved quote predates this or has none. */
  originLines: SurchargeBreakdownLine[];
  destLines: SurchargeBreakdownLine[];
  /** Sea FCL only — one row per container type/qty on the option. */
  containerLines: ContainerBreakdownLine[];
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
      dgFee: num(raw.dgFee),
      dgFeeBuy: num(raw.dgFeeBuy),
      dgFeeEnabled: raw.dgFeeEnabled !== false,
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

function asLiner(raw: Record<string, unknown>): LinerOption {
  return createLinerOption(
    {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      routing: String(raw.routing ?? ""),
      tt: String(raw.tt ?? ""),
      validity: String(raw.validity ?? ""),
      laneId: String(raw.laneId ?? ""),
      kind: raw.kind === "coloader" ? "coloader" : "liner",
      originFeesEnabled: raw.originFeesEnabled !== false,
      destFeesEnabled: raw.destFeesEnabled !== false,
      containers: Array.isArray(raw.containers)
        ? (raw.containers as LinerOption["containers"])
        : undefined,
      lclSell: num(raw.lclSell),
      lclBuy: num(raw.lclBuy),
      originSurcharges: Array.isArray(raw.originSurcharges)
        ? (raw.originSurcharges as LinerOption["originSurcharges"])
        : undefined,
      destSurcharges: Array.isArray(raw.destSurcharges)
        ? (raw.destSurcharges as LinerOption["destSurcharges"])
        : undefined,
    },
    Boolean(raw.selected),
  );
}

/** One line per container type/qty on a saved FCL option — mirrors legacy's
 * per-row container entry instead of collapsing straight to one total. */
function containerLinesFromRaw(raw: Record<string, unknown>): ContainerBreakdownLine[] {
  const list = Array.isArray(raw.containers) ? raw.containers.map(rec) : [];
  return list
    .map((c) => ({
      type: String(c.type ?? "Container"),
      qty: Math.max(0, num(c.qty)),
      rate: quoteSideRate(num(c.sellRate), num(c.buyRate)),
    }))
    .filter((c) => c.qty > 0)
    .map((c) => ({ ...c, amount: c.qty * c.rate }));
}

/** "20'GP"/"20'RF" → "20'", "40'HC"/"40'RF" → "40'" — the nominal size a
 * customer actually negotiates on, regardless of the exact sub-type. */
function nominalContainerSize(type: string): string {
  const m = /^(\d+)/.exec(type.trim());
  return m ? `${m[1]}'` : type.trim() || "Container";
}

/** Groups container rows by nominal size and sums each group — e.g. two
 * 20'GP rows plus one 40'HC row becomes one "20' Total" and one "40' Total",
 * shown alongside the per-row lines so a size's combined cost is never only
 * implicit in the option grand total. */
function containerSizeTotals(lines: ContainerBreakdownLine[]): SurchargeBreakdownLine[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const c of lines) {
    const size = nominalContainerSize(c.type);
    if (!totals.has(size)) {
      totals.set(size, 0);
      order.push(size);
    }
    totals.set(size, totals.get(size)! + c.amount);
  }
  return order.map((size) => ({ name: `${size} Total`, amount: totals.get(size)! }));
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
    dg: t.dg,
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

/** Persistable comparison-card snapshot for one courier/vendor option — carries
 * its own carrier/service/margin/surcharges so it can be reloaded and re-edited,
 * plus its computed total for the compare list and print pack. */
export function courierSnapshot(
  option: CourierOption,
  computed: {
    name: string;
    sellLocal: number;
    ratePerKg?: number;
    transit?: string;
    validity?: string;
    chargeableKg?: number;
    gstAmount?: number;
  },
  lanes: QuoteLane[],
  fallbackLaneId: string,
): Record<string, unknown> {
  const laneIndex = Math.max(
    0,
    lanes.findIndex((l) => l.id === (option.laneId || fallbackLaneId)),
  );
  const lane = lanes[laneIndex] ?? lanes[0];
  return {
    id: option.id,
    name: computed.name || "Untitled",
    kind: "courier",
    directoryCarrier: option.directoryCarrier,
    carrierId: option.carrierId,
    service: option.service,
    marginPct: option.marginPct,
    surcharges: option.surcharges,
    manualOverride: Boolean(option.manualOverride),
    manualSell: option.manualSell || 0,
    manualBuy: option.manualBuy || 0,
    selected: Boolean(option.selected),
    quoteTotal: computed.sellLocal,
    tt: computed.transit ?? "",
    appliedRate: computed.ratePerKg ?? 0,
    baseFreight: computed.sellLocal,
    chargeableWeight: computed.chargeableKg ?? 0,
    validity: computed.validity ?? "",
    gst: option.selected ? computed.gstAmount ?? 0 : 0,
    laneId: option.laneId || fallbackLaneId,
    laneLabel: lane ? laneRouteLabel(lane, laneIndex) : "",
  };
}

export function truckerSnapshot(
  t: {
    id: string;
    name: string;
    laneId?: string;
    selected: boolean;
    freightBuy: number;
    freightSell: number;
    detention: number;
    tolls: number;
  },
  validity: string,
  lanes: QuoteLane[] = [],
  fallbackLaneId = "",
  laneLabelOf: (lane: QuoteLane, index: number) => string = laneRouteLabel,
): Record<string, unknown> {
  const quoteTotal = t.freightSell + t.detention + t.tolls;
  const laneIndex = Math.max(
    0,
    lanes.findIndex((l) => l.id === (t.laneId || fallbackLaneId)),
  );
  const lane = lanes[laneIndex] ?? lanes[0];
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
    laneId: t.laneId || fallbackLaneId,
    laneLabel: lane ? laneLabelOf(lane, laneIndex) : "",
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
  seaCtx: { mode: SeaMode; grossWeightKg: number; volumeCbm: number; chargeableCbmOverride: number },
): FeeFields {
  const k = kind.toLowerCase();
  const computeAir = shouldComputeAirline(kind, quoteType);
  const computed =
    computeAir && (cargo.length || Array.isArray(raw.originSurcharges) || raw.breaks)
      ? computeAirlineTotals(cargo.length ? cargo : [{ l: 0, w: 0, h: 0, qty: 1, gw: 0 }], asAirline(raw))
      : null;

  const computeSea = !computeAir && quoteType.toLowerCase().includes("sea") && (k === "liner" || k === "coloader");
  const seaComputed =
    computeSea && (Array.isArray(raw.containers) || Array.isArray(raw.originSurcharges) || raw.lclSell || raw.lclBuy)
      ? computeLinerTotals(seaCtx.mode, seaCtx.grossWeightKg, seaCtx.volumeCbm, seaCtx.chargeableCbmOverride, asLiner(raw))
      : null;

  const freightSell = pick(raw.freightSell, 0, selectedFallback.freightSell, selected);
  const detention = pick(raw.detention, 0, selectedFallback.detention, selected);
  const tolls = pick(raw.tolls, 0, selectedFallback.tolls, selected);
  const storage = pick(raw.storage, 0, selectedFallback.storage, selected);
  const handling = pick(raw.handling, 0, selectedFallback.handling, selected);
  const gst = pick(raw.gst ?? raw.gstAmount, 0, selectedFallback.gst, selected);

  let baseFreight = pick(
    raw.baseFreight ?? raw.sellLocal,
    computed?.baseFreightQuote ?? seaComputed?.baseFreightQuote ?? 0,
    selectedFallback.baseFreight,
    selected,
  );
  if (k === "trucker" && baseFreight <= 0) baseFreight = freightSell;
  if (k === "warehouse" && baseFreight <= 0) baseFreight = storage;

  const originArr = computed?.origin ?? seaComputed?.origin ?? [];
  const destArr = computed?.dest ?? seaComputed?.dest ?? [];

  return {
    baseFreight,
    originFees: pick(
      raw.originFeesTotal ?? raw.originTotal,
      computed?.originTotal ?? seaComputed?.originTotal ?? 0,
      selectedFallback.originFees,
      selected,
    ),
    destFees: pick(
      raw.destFeesTotal ?? raw.destTotal,
      computed?.destTotal ?? seaComputed?.destTotal ?? 0,
      selectedFallback.destFees,
      selected,
    ),
    originLines: originArr.filter((r) => r.calculatedCost > 0).map((r) => ({ name: r.name, amount: r.calculatedCost })),
    destLines: destArr.filter((r) => r.calculatedCost > 0).map((r) => ({ name: r.name, amount: r.calculatedCost })),
    containerLines: computeSea && seaCtx.mode === "fcl" ? containerLinesFromRaw(raw) : [],
    ams: computeAir
      ? pick(raw.ams ?? raw.amsFee, computed?.ams ?? 0, selectedFallback.ams, selected)
      : 0,
    dg: computeAir
      ? pick(raw.dg ?? raw.dgFee, computed?.dg ?? 0, selectedFallback.dg, selected)
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

export type ChargeLine = { label: string; value: string };

/** Sell-side lines for on-screen inspect, print pack, and the client quote file. */
export function optionChargeLines(
  option: OptionBreakdown,
  currency: string,
  chargeableWeight: number,
): ChargeLine[] {
  const chw = option.chargeableWeight || chargeableWeight;
  const rate = option.appliedRate;
  const base = option.baseFreight;
  const kind = (option.kind || "").toLowerCase();
  const isTrucker = kind === "trucker" || kind === "transport";
  const isWarehouse = kind === "warehouse" || kind === "storage";
  const isSea = kind === "liner" || (kind === "coloader" && rate <= 0);
  const showKgRate = !isTrucker && !isWarehouse && !isSea && rate > 0 && chw > 0;
  const money = (n: number) => formatCurrency(n, currency);
  const lines: ChargeLine[] = [];
  if (isTrucker) {
    lines.push({ label: "Freight", value: money(option.freightSell || base) });
    if (option.detention > 0) lines.push({ label: "Detention", value: money(option.detention) });
    if (option.tolls > 0) lines.push({ label: "Tolls", value: money(option.tolls) });
  } else if (isWarehouse) {
    lines.push({ label: "Storage", value: money(option.storage || base) });
    if (option.handling > 0) lines.push({ label: "Handling", value: money(option.handling) });
  } else {
    if (isSea && option.containerLines.length) {
      for (const c of option.containerLines) {
        lines.push({
          label: `${c.type} × ${c.qty}`,
          value: c.rate > 0 ? `${money(c.rate)} × ${c.qty} = ${money(c.amount)}` : money(c.amount),
        });
      }
      if (option.containerLines.length > 1) {
        for (const t of containerSizeTotals(option.containerLines)) {
          lines.push({ label: t.name, value: money(t.amount) });
        }
      }
    } else {
      lines.push({
        label: "Base freight",
        value: showKgRate
          ? `${chw.toFixed(2)} kg × ${money(rate)}${option.quoteUsingBuyFreight ? " (from Buy)" : ""} = ${money(base)}`
          : money(base),
      });
    }
    if (option.originLines.length) {
      for (const o of option.originLines) lines.push({ label: o.name, value: money(o.amount) });
    } else if (option.originFees > 0) {
      lines.push({ label: "Origin fees", value: money(option.originFees) });
    }
    if (option.ams > 0) lines.push({ label: "AMS", value: money(option.ams) });
    if (option.dg > 0) lines.push({ label: "DG", value: money(option.dg) });
    if (option.destLines.length) {
      for (const o of option.destLines) lines.push({ label: o.name, value: money(o.amount) });
    } else if (option.destFees > 0) {
      lines.push({ label: "Destination fees", value: money(option.destFees) });
    }
    if (option.gst > 0) lines.push({ label: "GST", value: money(option.gst) });
  }
  lines.push({ label: "Option total", value: money(option.total) });
  return lines;
}

/** Drop duplicate vendor rows so a quoted option is never printed twice. */
export function uniqueOptionBreakdowns(options: OptionBreakdown[]): OptionBreakdown[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = `${String(o.id)}::${String(o.laneId || "")}::${o.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Screen inspect shows one breakup; print pack lists each option once.
 * Never show inspect + pack together on screen (that duplicated QR as "quoted" twice).
 */
export function quotePreviewPanelCounts(optionCount: number): { screen: number; print: number } {
  const n = Math.max(0, optionCount);
  return { screen: n > 0 ? 1 : 0, print: n };
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
    dg: num(d.dgFee ?? d.dg),
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
    originLines: [],
    destLines: [],
    containerLines: [],
  };
  const seaCtx = {
    mode: (String(d.type || "fcl") as SeaMode),
    grossWeightKg: num(d.grossWeight),
    volumeCbm: num(d.volumeCbm),
    chargeableCbmOverride: num(d.chargeableCbmOverride),
  };
  const options = rawOptions(d);

  return vendors.map((v) => {
    const raw =
      options.find((o) => String(o.id ?? "") === v.id) ||
      options.find((o) => String(o.name ?? "").trim().toLowerCase() === v.name.trim().toLowerCase()) ||
      {};
    const fees = totalsFromRaw(raw, cargo, selectedFallback, v.selected, v.kind, quoteType, seaCtx);
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
