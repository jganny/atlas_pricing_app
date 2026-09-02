import {
  calculateSeaFreight,
  type SeaContainerLine,
  type SeaMode,
} from "@atlas/pricing-core";

export interface SeaContainerRow {
  type: string;
  qty: number;
  sellRate: number;
  buyRate: number;
}

export interface SeaDeskInput {
  customer: string;
  origin: string;
  destination: string;
  currency: string;
  incoterm: string;
  liner: string;
  routing: string;
  tt: string;
  validity: string;
  mode: SeaMode;
  grossWeightKg: number;
  volumeCbm: number;
  chargeableCbmOverride: number;
  containers: SeaContainerRow[];
  lclSell: number;
  lclBuy: number;
}

export function computeSeaDesk(input: SeaDeskInput) {
  const containers: SeaContainerLine[] = input.containers.map((c) => ({
    type: c.type,
    qty: c.qty,
    sellRate: c.sellRate,
    buyRate: c.buyRate,
  }));

  return calculateSeaFreight({
    mode: input.mode,
    grossWeightKg: input.grossWeightKg,
    volumeCbm: input.volumeCbm,
    chargeableCbmOverride: input.chargeableCbmOverride,
    containers: input.mode === "fcl" ? containers : undefined,
    lclRate: { sell: input.lclSell, buy: input.lclBuy },
    bbRate: { sell: input.lclSell, buy: input.lclBuy },
  });
}

export function validateSeaDesk(input: SeaDeskInput): string | null {
  if (!input.customer.trim()) return "Enter customer name.";
  if (!input.origin.trim()) return "Enter port of loading.";
  if (!input.destination.trim()) return "Enter port of discharge.";
  if (input.grossWeightKg <= 0) return "Enter gross weight (kg).";
  if (input.volumeCbm <= 0) return "Enter volume (CBM).";
  if (!input.liner.trim()) return "Enter liner / carrier.";
  if (!input.routing.trim()) return "Enter routing.";
  if (!input.tt.trim()) return "Enter transit time.";
  if (!input.validity.trim()) return "Enter quote validity.";
  if (input.mode === "fcl") {
    if (!input.containers.length) return "Add at least one container row.";
    for (const c of input.containers) {
      if (c.qty <= 0) return "Container quantity must be greater than zero.";
      if (c.sellRate <= 0 && c.buyRate <= 0) return "Enter sell or buy rate for each container row.";
    }
  } else if (input.lclSell <= 0 && input.lclBuy <= 0) {
    return "Enter LCL sell or buy rate.";
  }
  return null;
}
