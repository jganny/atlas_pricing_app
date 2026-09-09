import type { WeightBreaks } from "@atlas/pricing-core";
import { normalizeRouting } from "@/lib/pricing/terms";
import {
  defaultAirDestSurcharges,
  defaultAirOriginSurcharges,
  defaultSeaDestSurcharges,
  defaultSeaOriginSurcharges,
  type SurchargeRow,
} from "@/lib/pricing/surcharges";
import { EMPTY_AIR_BREAKS } from "@/lib/pricing/air-desk";
import type { SeaContainerRow } from "@/lib/pricing/sea-desk";

export function newCarrierId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface AirlineOption {
  id: string;
  name: string;
  routing: string;
  tt: string;
  validity: string;
  pivotWeightKg: number;
  amsFee: number;
  /** AMS buy/cost. Quote AMS uses sell when set, else buy. */
  amsFeeBuy: number;
  amsFeeEnabled: boolean;
  laneId?: string;
  kind?: "airline" | "coloader";
  wbEnabled: boolean;
  originFeesEnabled: boolean;
  destFeesEnabled: boolean;
  breaks: WeightBreaks;
  originSurcharges: SurchargeRow[];
  destSurcharges: SurchargeRow[];
  selected: boolean;
}

export function createAirlineOption(
  partial: Partial<AirlineOption> = {},
  selected = false,
): AirlineOption {
  return {
    id: partial.id ?? newCarrierId("air"),
    name: partial.name ?? "",
    routing: normalizeRouting(partial.routing ?? ""),
    tt: partial.tt ?? "",
    validity: partial.validity ?? "",
    pivotWeightKg: partial.pivotWeightKg ?? 0,
    amsFee: partial.amsFee ?? 0,
    amsFeeBuy: partial.amsFeeBuy ?? 0,
    amsFeeEnabled: partial.amsFeeEnabled ?? true,
    laneId: partial.laneId ?? "",
    kind: partial.kind ?? "airline",
    wbEnabled: partial.wbEnabled ?? true,
    originFeesEnabled: partial.originFeesEnabled ?? true,
    destFeesEnabled: partial.destFeesEnabled ?? true,
    breaks: partial.breaks ?? { ...EMPTY_AIR_BREAKS },
    originSurcharges: partial.originSurcharges ?? defaultAirOriginSurcharges(),
    destSurcharges: partial.destSurcharges ?? defaultAirDestSurcharges(),
    selected,
  };
}

/** When rates were typed under Buy first, copy blank Sell cells from Buy. */
export function copyAirBuyRatesToSell(option: AirlineOption): AirlineOption {
  const breakNames = Object.keys(EMPTY_AIR_BREAKS) as Array<keyof WeightBreaks>;
  const breaks = { ...option.breaks };
  for (const name of breakNames) {
    const pair = breaks[name] ?? { sell: 0, buy: 0 };
    breaks[name] = {
      sell: pair.sell > 0 ? pair.sell : pair.buy || 0,
      buy: pair.buy || 0,
    };
  }
  return {
    ...option,
    breaks,
    originSurcharges: option.originSurcharges.map((r) => ({
      ...r,
      sell: r.sell > 0 ? r.sell : r.buy || 0,
    })),
    destSurcharges: option.destSurcharges.map((r) => ({
      ...r,
      sell: r.sell > 0 ? r.sell : r.buy || 0,
    })),
    amsFee: option.amsFee > 0 ? option.amsFee : option.amsFeeBuy || 0,
  };
}

export interface LinerOption {
  id: string;
  name: string;
  routing: string;
  tt: string;
  validity: string;
  laneId?: string;
  kind?: "liner" | "coloader";
  originFeesEnabled: boolean;
  destFeesEnabled: boolean;
  containers: SeaContainerRow[];
  lclSell: number;
  lclBuy: number;
  originSurcharges: SurchargeRow[];
  destSurcharges: SurchargeRow[];
  selected: boolean;
}

export function createLinerOption(
  partial: Partial<LinerOption> = {},
  selected = false,
): LinerOption {
  return {
    id: partial.id ?? newCarrierId("sea"),
    name: partial.name ?? "",
    routing: normalizeRouting(partial.routing ?? ""),
    tt: partial.tt ?? "",
    validity: partial.validity ?? "",
    laneId: partial.laneId ?? "",
    kind: partial.kind ?? "liner",
    originFeesEnabled: partial.originFeesEnabled ?? true,
    destFeesEnabled: partial.destFeesEnabled ?? true,
    containers: partial.containers ?? [
      { type: "20'GP", qty: 1, sellRate: 0, buyRate: 0 },
    ],
    lclSell: partial.lclSell ?? 0,
    lclBuy: partial.lclBuy ?? 0,
    originSurcharges: partial.originSurcharges ?? defaultSeaOriginSurcharges(),
    destSurcharges: partial.destSurcharges ?? defaultSeaDestSurcharges(),
    selected,
  };
}

export interface TruckerOption {
  id: string;
  name: string;
  selected: boolean;
  freightBuy: number;
  freightSell: number;
  detention: number;
  tolls: number;
}

export function truckerQuoteTotal(
  t: Pick<TruckerOption, "freightSell" | "detention" | "tolls">,
): number {
  return (Number(t.freightSell) || 0) + (Number(t.detention) || 0) + (Number(t.tolls) || 0);
}

export function createTruckerOption(
  partial: Partial<TruckerOption> = {},
  selected = false,
): TruckerOption {
  return {
    id: partial.id ?? newCarrierId("trk"),
    name: partial.name ?? "",
    selected,
    freightBuy: partial.freightBuy ?? 0,
    freightSell: partial.freightSell ?? 0,
    detention: partial.detention ?? 0,
    tolls: partial.tolls ?? 0,
  };
}

/** Explicit fields only — never spread optional keys as `undefined` into Firestore. */
export function serializeAirlineOption(a: AirlineOption): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: a.id,
    name: a.name,
    routing: normalizeRouting(a.routing),
    tt: a.tt,
    validity: a.validity,
    pivotWeightKg: a.pivotWeightKg || 0,
    amsFee: a.amsFee || 0,
    amsFeeBuy: a.amsFeeBuy || 0,
    amsFeeEnabled: a.amsFeeEnabled !== false,
    kind: a.kind || "airline",
    wbEnabled: a.wbEnabled !== false,
    originFeesEnabled: a.originFeesEnabled !== false,
    destFeesEnabled: a.destFeesEnabled !== false,
    breaks: a.breaks,
    originSurcharges: a.originSurcharges,
    destSurcharges: a.destSurcharges,
    selected: Boolean(a.selected),
  };
  if (a.laneId) row.laneId = a.laneId;
  return row;
}

export function serializeLinerOption(l: LinerOption): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: l.id,
    name: l.name,
    routing: normalizeRouting(l.routing),
    tt: l.tt,
    validity: l.validity,
    kind: l.kind || "liner",
    originFeesEnabled: l.originFeesEnabled !== false,
    destFeesEnabled: l.destFeesEnabled !== false,
    containers: l.containers,
    lclSell: l.lclSell || 0,
    lclBuy: l.lclBuy || 0,
    originSurcharges: l.originSurcharges,
    destSurcharges: l.destSurcharges,
    selected: Boolean(l.selected),
  };
  if (l.laneId) row.laneId = l.laneId;
  return row;
}
