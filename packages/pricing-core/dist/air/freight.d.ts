import type { AirFreightInput, AirFreightResult } from "../types.js";
/**
 * Sell and buy freights are independent.
 * Buy rates must never inflate sell totals / GP when sell is still blank.
 */
export declare function calculateAirFreight(input: AirFreightInput): AirFreightResult;
//# sourceMappingURL=freight.d.ts.map