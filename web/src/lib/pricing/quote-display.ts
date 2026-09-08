/**
 * Gross profit is only meaningful when both sell and buy sides have real money.
 * AMS / fees alone must not invent a GP when freight sell (or buy) is still blank.
 */
export function computeGp(grandSell: number, grandBuy: number): {
  gp: number;
  gpReady: boolean;
} {
  const sellOk = grandSell > 0;
  const buyOk = grandBuy > 0;
  const gpReady = sellOk && buyOk;
  return {
    gp: gpReady ? grandSell - grandBuy : 0,
    gpReady,
  };
}

export {
  ensureIncidentalTerm,
  formatRoutingPreview,
  formatTransitPreview,
  normalizeRouting,
  INCIDENTAL_TERM,
} from "@/lib/pricing/terms";
