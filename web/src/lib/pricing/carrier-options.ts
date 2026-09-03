import type { WeightBreaks } from "@atlas/pricing-core";
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
  amsFeeEnabled: boolean;
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
    routing: partial.routing ?? "",
    tt: partial.tt ?? "",
    validity: partial.validity ?? "",
    pivotWeightKg: partial.pivotWeightKg ?? 0,
    amsFee: partial.amsFee ?? 0,
    amsFeeEnabled: partial.amsFeeEnabled ?? true,
    wbEnabled: partial.wbEnabled ?? true,
    originFeesEnabled: partial.originFeesEnabled ?? true,
    destFeesEnabled: partial.destFeesEnabled ?? true,
    breaks: partial.breaks ?? {
      ...EMPTY_AIR_BREAKS,
      minus45: { sell: 2.8, buy: 2.4 },
      plus45: { sell: 2.5, buy: 2.1 },
      plus100: { sell: 2.2, buy: 1.9 },
      min: { sell: 150, buy: 120 },
    },
    originSurcharges: partial.originSurcharges ?? defaultAirOriginSurcharges(),
    destSurcharges: partial.destSurcharges ?? defaultAirDestSurcharges(),
    selected,
  };
}

export interface LinerOption {
  id: string;
  name: string;
  routing: string;
  tt: string;
  validity: string;
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
    routing: partial.routing ?? "",
    tt: partial.tt ?? "",
    validity: partial.validity ?? "",
    originFeesEnabled: partial.originFeesEnabled ?? true,
    destFeesEnabled: partial.destFeesEnabled ?? true,
    containers: partial.containers ?? [
      { type: "20'GP", qty: 1, sellRate: 800, buyRate: 700 },
    ],
    lclSell: partial.lclSell ?? 45,
    lclBuy: partial.lclBuy ?? 40,
    originSurcharges: partial.originSurcharges ?? defaultSeaOriginSurcharges(),
    destSurcharges: partial.destSurcharges ?? defaultSeaDestSurcharges(),
    selected,
  };
}
