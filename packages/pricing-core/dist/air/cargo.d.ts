import type { CargoLine, CargoSummary, DimUnit } from "../types.js";
export declare function summarizeCargo(cargo: CargoLine[], dimUnit?: DimUnit): CargoSummary;
export declare function chargeableWeightKg(cargo: CargoSummary, pivotWeightKg?: number): number;
//# sourceMappingURL=cargo.d.ts.map