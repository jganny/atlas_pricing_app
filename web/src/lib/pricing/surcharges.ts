/** Shared local surcharge rows — mirrors legacy chg-name / chg-rate / chg-unit. */

export type BillingUnit = "kg" | "flat" | "cbm" | "container";

export interface SurchargeRow {
  id: string;
  name: string;
  sell: number;
  buy: number;
  unit: BillingUnit;
  remarks: string;
}

export interface CalculatedSurcharge extends SurchargeRow {
  calculatedCost: number;
  calculatedBuy: number;
}

export function newSurchargeId(): string {
  return `sch_${Math.random().toString(36).slice(2, 9)}`;
}

export function createSurchargeRow(
  partial: Partial<SurchargeRow> & { name: string },
): SurchargeRow {
  return {
    id: partial.id ?? newSurchargeId(),
    name: partial.name,
    sell: partial.sell ?? 0,
    buy: partial.buy ?? 0,
    unit: partial.unit ?? "flat",
    remarks: partial.remarks ?? "",
  };
}

export function defaultAirOriginSurcharges(): SurchargeRow[] {
  return [
    createSurchargeRow({ name: "Xray", sell: 0, buy: 0, unit: "kg" }),
    createSurchargeRow({ name: "Cartage", sell: 0, buy: 0, unit: "flat" }),
    createSurchargeRow({ name: "Misc", sell: 0, buy: 0, unit: "flat" }),
  ];
}

export function defaultAirDestSurcharges(): SurchargeRow[] {
  return [
    createSurchargeRow({ name: "Destination THC", sell: 0, buy: 0, unit: "flat" }),
  ];
}

export function defaultSeaOriginSurcharges(): SurchargeRow[] {
  return [
    createSurchargeRow({ name: "Origin THC", sell: 0, buy: 0, unit: "container" }),
    createSurchargeRow({ name: "Documentation", sell: 0, buy: 0, unit: "flat" }),
  ];
}

export function defaultSeaDestSurcharges(): SurchargeRow[] {
  return [
    createSurchargeRow({ name: "Destination THC", sell: 0, buy: 0, unit: "container" }),
    createSurchargeRow({ name: "Delivery order", sell: 0, buy: 0, unit: "flat" }),
  ];
}

/**
 * Calculate surcharge cost.
 * kg → × chargeable kg; cbm → × CBM/RT; container → × container count; flat → rate as-is.
 */
export function calcSurchargeCost(
  row: SurchargeRow,
  bases: { chargeableKg?: number; cbm?: number; containerCount?: number },
): CalculatedSurcharge {
  const sellRate = row.sell > 0 ? row.sell : row.buy;
  const buyRate = row.buy;
  let multiplier = 1;
  if (row.unit === "kg") multiplier = bases.chargeableKg ?? 0;
  else if (row.unit === "cbm") multiplier = bases.cbm ?? 0;
  else if (row.unit === "container") multiplier = bases.containerCount ?? 1;

  const calculatedCost = sellRate * multiplier;
  const calculatedBuy = buyRate * multiplier;
  return { ...row, calculatedCost, calculatedBuy };
}

export function sumSurcharges(rows: CalculatedSurcharge[]) {
  return {
    sell: rows.reduce((s, r) => s + r.calculatedCost, 0),
    buy: rows.reduce((s, r) => s + r.calculatedBuy, 0),
  };
}
