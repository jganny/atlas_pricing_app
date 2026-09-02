import {
  calculateAirFreight,
  type CargoLine,
  type WeightBreakName,
  type WeightBreaks,
} from "@atlas/pricing-core";

export const AIR_WEIGHT_BREAKS: WeightBreakName[] = [
  "min",
  "minus45",
  "plus45",
  "plus100",
  "plus300",
  "plus500",
  "plus1000",
];

export const EMPTY_AIR_BREAKS: WeightBreaks = {
  min: { sell: 0, buy: 0 },
  minus45: { sell: 0, buy: 0 },
  plus45: { sell: 0, buy: 0 },
  plus100: { sell: 0, buy: 0 },
  plus300: { sell: 0, buy: 0 },
  plus500: { sell: 0, buy: 0 },
  plus1000: { sell: 0, buy: 0 },
};

export interface AirCargoRow {
  l: number;
  w: number;
  h: number;
  qty: number;
  gw: number;
}

export interface AirDeskInput {
  customer: string;
  origin: string;
  destination: string;
  currency: string;
  incoterm: string;
  commodity: string;
  airline: string;
  routing: string;
  tt: string;
  validity: string;
  pivotWeightKg: number;
  cargo: AirCargoRow[];
  breaks: WeightBreaks;
}

export function cargoRowsToLines(rows: AirCargoRow[]): CargoLine[] {
  return rows.map((r) => ({
    length: r.l,
    width: r.w,
    height: r.h,
    qty: r.qty,
    grossWeightKg: r.gw,
  }));
}

export function computeAirDesk(input: AirDeskInput) {
  return calculateAirFreight({
    cargo: cargoRowsToLines(input.cargo),
    breaks: input.breaks,
    pivotWeightKg: input.pivotWeightKg,
  });
}

export function validateAirDesk(input: AirDeskInput): string | null {
  if (!input.customer.trim()) return "Enter customer name.";
  if (!input.origin.trim()) return "Enter origin airport.";
  if (!input.destination.trim()) return "Enter destination airport.";
  if (!input.cargo.length) return "Add at least one cargo line.";
  for (const row of input.cargo) {
    if (row.l <= 0 || row.w <= 0 || row.h <= 0 || row.qty <= 0 || row.gw <= 0) {
      return "Fill all cargo dimensions and weights with values greater than zero.";
    }
  }
  if (!input.airline.trim()) return "Enter carrier / airline.";
  if (!input.routing.trim()) return "Enter routing.";
  if (!input.tt.trim()) return "Enter transit time.";
  if (!input.validity.trim()) return "Enter quote validity.";
  return null;
}
