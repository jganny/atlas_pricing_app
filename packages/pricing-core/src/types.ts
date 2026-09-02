export type DimUnit = "cms" | "inches";

export type WeightBreakName =
  | "min"
  | "minus45"
  | "plus45"
  | "plus100"
  | "plus300"
  | "plus500"
  | "plus1000";

export interface RatePair {
  sell: number;
  buy: number;
}

export type WeightBreaks = Partial<Record<WeightBreakName, RatePair>>;

export interface CargoLine {
  length: number;
  width: number;
  height: number;
  qty: number;
  grossWeightKg: number;
}

export interface CargoSummary {
  grossWeightKg: number;
  volumeWeightKg: number;
  volumeCbm: number;
  packageQty: number;
}

export interface InterimRate {
  rate: number;
  isFallback: boolean;
}

export interface AirFreightInput {
  cargo: CargoLine[];
  dimUnit?: DimUnit;
  pivotWeightKg?: number;
  breaks: WeightBreaks;
  tariffsEnabled?: boolean;
  weightBreaksEnabled?: boolean;
}

export interface AirFreightResult {
  cargo: CargoSummary;
  chargeableWeightKg: number;
  usedBreak: WeightBreakName;
  activeRate: number;
  activeBuyRate: number;
  usingBuyFallback: boolean;
  isMinActive: boolean;
  baseFreightSell: number;
  baseFreightBuy: number;
}

export type SeaMode = "fcl" | "lcl" | "bb";

export interface SeaContainerLine {
  type: string;
  qty: number;
  sellRate: number;
  buyRate: number;
}

export interface SeaFreightInput {
  mode: SeaMode;
  grossWeightKg: number;
  volumeCbm: number;
  chargeableCbmOverride?: number;
  containers?: SeaContainerLine[];
  lclRate?: RatePair;
  bbRate?: RatePair;
  tariffsEnabled?: boolean;
}

export interface SeaFreightResult {
  chargeableRt: number;
  baseFreightSell: number;
  baseFreightBuy: number;
  usingBuyFallback: boolean;
  containerSummary: string[];
  containerCount: number;
}
