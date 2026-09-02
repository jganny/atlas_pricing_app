import {
  calculateAirFreight,
  calculateSeaFreight,
  type CargoLine,
  type SeaContainerLine,
} from "@atlas/pricing-core";
import type { AirTariff, ParsedEnquiry, SeaTariff } from "@/lib/types";

function packagesToCargo(packages: ParsedEnquiry["packages"]): CargoLine[] {
  return packages.map((p) => ({
    length: p.l ?? 0,
    width: p.w ?? 0,
    height: p.h ?? 0,
    qty: p.qty,
    grossWeightKg: p.gw ?? 0,
  }));
}

export function estimateAirFreightFromTariff(
  parsed: ParsedEnquiry,
  tariff: AirTariff,
): number {
  const result = calculateAirFreight({
    cargo: packagesToCargo(parsed.packages),
    breaks: tariff.breaks,
  });
  return result.baseFreightSell;
}

export function estimateSeaFreightFromTariff(
  parsed: ParsedEnquiry,
  tariff: SeaTariff,
): number {
  const mode = parsed.mode ?? tariff.mode;
  const containers: SeaContainerLine[] = parsed.containers.map((c) => ({
    type: c.type,
    qty: c.qty,
    sellRate: tariff.fclRates[c.type]?.sell ?? 0,
    buyRate: tariff.fclRates[c.type]?.buy ?? 0,
  }));

  const result = calculateSeaFreight({
    mode,
    grossWeightKg: parsed.grossWeight ?? 0,
    volumeCbm: parsed.volume ?? 0,
    containers: mode === "fcl" ? containers : undefined,
    lclRate: tariff.lclRate,
    bbRate: tariff.lclRate,
  });
  return result.baseFreightSell;
}
