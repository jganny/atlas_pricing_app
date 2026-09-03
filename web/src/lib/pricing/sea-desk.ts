import {
  calculateSeaFreight,
  type SeaContainerLine,
  type SeaMode,
} from "@atlas/pricing-core";
import type { LinerOption } from "@/lib/pricing/carrier-options";
import {
  calcSurchargeCost,
  sumSurcharges,
  type CalculatedSurcharge,
} from "@/lib/pricing/surcharges";

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

export interface LinerTotals {
  freight: ReturnType<typeof calculateSeaFreight>;
  origin: CalculatedSurcharge[];
  dest: CalculatedSurcharge[];
  originTotal: number;
  destTotal: number;
  grandSell: number;
  grandBuy: number;
  gp: number;
}

export function computeLinerTotals(
  mode: SeaMode,
  grossWeightKg: number,
  volumeCbm: number,
  chargeableCbmOverride: number,
  option: LinerOption,
): LinerTotals {
  const freight = calculateSeaFreight({
    mode,
    grossWeightKg,
    volumeCbm,
    chargeableCbmOverride,
    containers:
      mode === "fcl"
        ? option.containers.map((c) => ({
            type: c.type,
            qty: c.qty,
            sellRate: c.sellRate,
            buyRate: c.buyRate,
          }))
        : undefined,
    lclRate: { sell: option.lclSell, buy: option.lclBuy },
    bbRate: { sell: option.lclSell, buy: option.lclBuy },
  });

  const bases = {
    cbm: freight.chargeableRt,
    containerCount: freight.containerCount || 1,
  };

  const origin = option.originFeesEnabled
    ? option.originSurcharges
        .filter((r) => r.name.trim())
        .map((r) => calcSurchargeCost(r, bases))
    : [];
  const dest = option.destFeesEnabled
    ? option.destSurcharges
        .filter((r) => r.name.trim())
        .map((r) => calcSurchargeCost(r, bases))
    : [];

  const originSum = sumSurcharges(origin);
  const destSum = sumSurcharges(dest);
  const grandSell = freight.baseFreightSell + originSum.sell + destSum.sell;
  const grandBuy = freight.baseFreightBuy + originSum.buy + destSum.buy;

  return {
    freight,
    origin,
    dest,
    originTotal: originSum.sell,
    destTotal: destSum.sell,
    grandSell,
    grandBuy,
    gp: grandSell - grandBuy,
  };
}

export function validateSeaCargoBasics(grossWeightKg: number, volumeCbm: number): string | null {
  if (grossWeightKg <= 0) return "Enter gross weight (kg).";
  if (volumeCbm <= 0) return "Enter volume (CBM).";
  return null;
}

export function validateSelectedLiner(
  option: LinerOption | undefined,
  mode: SeaMode,
): string | null {
  if (!option) return "Add and select a liner option.";
  if (!option.name.trim()) return "Enter liner / carrier on the selected option.";
  if (!option.routing.trim()) return "Enter routing on the selected option.";
  if (!option.tt.trim()) return "Enter transit time on the selected option.";
  if (!option.validity.trim()) return "Enter quote validity on the selected option.";
  if (mode === "fcl") {
    if (!option.containers.length) return "Add at least one container row.";
    for (const c of option.containers) {
      if (c.qty <= 0) return "Container quantity must be greater than zero.";
      if (c.sellRate <= 0 && c.buyRate <= 0) {
        return "Enter sell or buy rate for each container row.";
      }
    }
  } else if (option.lclSell <= 0 && option.lclBuy <= 0) {
    return "Enter LCL sell or buy rate on the selected option.";
  }
  return null;
}

export function validateSeaDesk(input: SeaDeskInput): string | null {
  if (!input.customer.trim()) return "Enter customer name.";
  if (!input.origin.trim()) return "Enter port of loading.";
  if (!input.destination.trim()) return "Enter port of discharge.";
  const cargoErr = validateSeaCargoBasics(input.grossWeightKg, input.volumeCbm);
  if (cargoErr) return cargoErr;
  return validateSelectedLiner(
    {
      id: "legacy",
      name: input.liner,
      routing: input.routing,
      tt: input.tt,
      validity: input.validity,
      originFeesEnabled: true,
      destFeesEnabled: true,
      containers: input.containers,
      lclSell: input.lclSell,
      lclBuy: input.lclBuy,
      originSurcharges: [],
      destSurcharges: [],
      selected: true,
    },
    input.mode,
  );
}

/** Heavy cargo warning threshold — mirrors legacy sea desk alert. */
export function seaHeavyWeightWarning(grossWeightKg: number, containerCount: number): string | null {
  if (containerCount <= 0) return null;
  const perBox = grossWeightKg / containerCount;
  if (perBox >= 22000) {
    return `Heavy cargo: ~${Math.round(perBox)} kg per container. Confirm multi-axle / overweight trailer capability before booking.`;
  }
  if (grossWeightKg >= 18000 && containerCount === 1) {
    return "Cargo may need special trailer equipment — confirm with operations.";
  }
  return null;
}
