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

export type CourierDimUnit = "cm" | "in";
export type CourierServiceKey = "express" | "economy" | "same_day" | "document";

export interface CourierPackageLine {
  qty: number;
  gw?: number;
  l?: number;
  w?: number;
  h?: number;
}

export interface CourierSurchargeInput {
  fuelPct: number;
  remote: boolean;
  remoteAmount: number;
  residential: boolean;
  residentialAmount: number;
  saturday: boolean;
  saturdayAmount: number;
  dg: boolean;
  dgAmount: number;
  insurance: boolean;
  insurancePct: number;
  declaredValue: number;
  oversized: boolean;
  oversizedAmount: number;
}

export interface CourierFreightInput {
  packages: CourierPackageLine[];
  dimUnit?: CourierDimUnit;
  originCountry: string;
  destCountry: string;
  service: CourierServiceKey;
  currency: string;
  marginPct: number;
  selectedCarrierId?: string;
  gstEnabled?: boolean;
  surcharges: CourierSurchargeInput;
}

export interface CourierCarrierQuote {
  id: string;
  name: string;
  color: string;
  buyUsd: number;
  sellUsd: number;
  buyLocal: number;
  sellLocal: number;
  ratePerKg: number;
  transit: string;
}

export interface CourierFreightResult {
  packages: Array<CourierPackageLine & { volPerPiece: number; chargeable: number }>;
  chargeableKg: number;
  zone: number;
  oversized: boolean;
  quotes: CourierCarrierQuote[];
  chosen: CourierCarrierQuote | undefined;
  baseFreight: number;
  buyFreight: number;
  surcharges: {
    fuel: number;
    fuelPct: number;
    remote: number;
    residential: number;
    saturday: number;
    dg: number;
    insurance: number;
    oversized: number;
    total: number;
    declaredValue: number;
  };
  subtotal: number;
  tax: number;
  total: number;
  grossProfit: number;
}
