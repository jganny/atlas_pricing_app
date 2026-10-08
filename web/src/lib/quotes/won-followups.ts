/** Won-conversion follow-up: which details are still blank, and how urgent that is. */

export interface WonFollowUpValues {
  shipperName: string;
  consigneeName: string;
  commodity: string;
  buyRate: number;
  sellAmount: number;
}

export type WonFollowUpField = keyof WonFollowUpValues;

export const WON_FOLLOWUP_FIELD_LABELS: Record<WonFollowUpField, string> = {
  shipperName: "Shipper",
  consigneeName: "Consignee",
  commodity: "Commodity",
  buyRate: "Buy rate",
  sellAmount: "Sell amount",
};

/** A field counts as blank the same way the rest of this app treats an unset rate: empty string or <= 0. */
export function missingWonFields(v: WonFollowUpValues): WonFollowUpField[] {
  const out: WonFollowUpField[] = [];
  if (!v.shipperName.trim()) out.push("shipperName");
  if (!v.consigneeName.trim()) out.push("consigneeName");
  if (!v.commodity.trim()) out.push("commodity");
  if (!(v.buyRate > 0)) out.push("buyRate");
  if (!(v.sellAmount > 0)) out.push("sellAmount");
  return out;
}

/**
 * Which rows are still waiting and which are done — judged on what is SAVED, never on
 * what is half-typed. (Judging on the typed text made a row vanish the moment its last
 * missing field got its first letter, before the user could press Save.)
 */
export function splitWonRows<T extends WonFollowUpValues & { wonAt: string }>(
  rows: T[],
): { pending: T[]; complete: T[] } {
  const pending = rows
    .filter((r) => missingWonFields(r).length > 0)
    .sort((a, b) => new Date(a.wonAt).getTime() - new Date(b.wonAt).getTime());
  const complete = rows.filter((r) => missingWonFields(r).length === 0);
  return { pending, complete };
}

export type EscalationTier = "quiet" | "amber" | "red";

export function daysSince(dateIso: string, now: Date = new Date()): number {
  const then = new Date(dateIso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

/** Day 0-2 quiet, day 3-7 amber, day 8+ red — gets louder, never blocks. */
export function escalationTier(wonAt: string, now: Date = new Date()): EscalationTier {
  const days = daysSince(wonAt, now);
  if (days >= 8) return "red";
  if (days >= 3) return "amber";
  return "quiet";
}
