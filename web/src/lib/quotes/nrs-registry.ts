/**
 * NRS directory — one record per Air/Sea nomination booking, kept in the same
 * `nrs_registry` collection (same field names) the original app wrote, so every
 * booking made there is still here and anything added here is still readable there.
 */
import { quoteDeskSeatId } from "@/lib/auth/desk-seats";

export const NRS_FOLLOWUP_STATUSES = [
  "Awaiting Response",
  "Documents Pending",
  "Booking Confirmed by Shipper",
  "Shipment Dispatched",
  "Completed",
] as const;

export type NrsRegistryFollowUp = {
  date: string;
  time: string;
  status: string;
  note: string;
  by: string;
};

export type NrsRegistryEntry = {
  id: string;
  refId?: string;
  mode?: string;
  agent?: string;
  pol?: string;
  pod?: string;
  shipperName?: string;
  shipperPhone?: string;
  shipperEmail?: string;
  shipperAddress?: string;
  consigneeName?: string;
  consigneePhone?: string;
  consigneeEmail?: string;
  consigneeAddress?: string;
  commodity?: string;
  dateWon?: string;
  confirmedCarrier?: string;
  confirmedBuyRate?: number;
  grossProfit?: number;
  grossProfitINR?: number;
  grossProfitCurrency?: string;
  creator?: string;
  /** Desk the booking belongs to (stamped when confirmed). */
  deskSeat?: string;
  pendingShipperDetails?: boolean;
  followUps?: NrsRegistryFollowUp[];
};

export type NrsPartyFields = Pick<
  NrsRegistryEntry,
  | "shipperName"
  | "shipperPhone"
  | "shipperEmail"
  | "shipperAddress"
  | "consigneeName"
  | "consigneePhone"
  | "consigneeEmail"
  | "consigneeAddress"
  | "commodity"
>;

/** Only bookings made by the Air/Sea nomination desks belong in the NRS directory. */
export function isNominationBooking(e: NrsRegistryEntry): boolean {
  if (e.deskSeat || e.creator) {
    const seat = quoteDeskSeatId({ deskSeat: e.deskSeat, creator: e.creator });
    return seat === "air-nom" || seat === "sea-nom";
  }
  const prefix = (e.refId || "").substring(0, 2).toUpperCase();
  if (["AE", "AI", "SE", "SI"].includes(prefix)) return true;
  return (e.mode || "").includes("Nomination");
}

/** True while either party is still missing. */
export function registryNeedsDetails(e: NrsRegistryEntry): boolean {
  return !(e.shipperName && e.consigneeName);
}

export function searchRegistry(list: NrsRegistryEntry[], q: string): NrsRegistryEntry[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((e) =>
    [e.refId, e.agent, e.pol, e.pod, e.shipperName, e.consigneeName, e.commodity, e.mode, e.confirmedCarrier]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

export function sortRegistry(list: NrsRegistryEntry[]): NrsRegistryEntry[] {
  return [...list].sort((a, b) => (b.dateWon || "").localeCompare(a.dateWon || ""));
}

/** The record written when a nomination desk confirms (wins) a quote. */
export function buildRegistryEntry(input: {
  quoteId: string;
  ref: string;
  customer: string;
  mode: string;
  pol: string;
  pod: string;
  shipperName?: string;
  consigneeName?: string;
  commodity?: string;
  confirmedCarrier?: string;
  confirmedBuyRate?: number;
  grossProfit?: number;
  grossProfitINR?: number;
  grossProfitCurrency?: string;
  creator?: string;
  deskSeat?: string;
  wonOn?: string;
}): NrsRegistryEntry {
  const entry: NrsRegistryEntry = {
    id: input.quoteId,
    refId: input.ref,
    mode: input.mode === "sea" ? "Sea Nomination" : "Air Nomination",
    agent: input.customer,
    pol: input.pol,
    pod: input.pod,
    shipperName: input.shipperName?.trim() || "",
    consigneeName: input.consigneeName?.trim() || "",
    commodity: input.commodity?.trim() || "",
    dateWon: input.wonOn ?? new Date().toISOString().split("T")[0],
    confirmedCarrier: input.confirmedCarrier || "",
    confirmedBuyRate: input.confirmedBuyRate ?? 0,
    grossProfit: input.grossProfit ?? 0,
    grossProfitINR: input.grossProfitINR ?? 0,
    grossProfitCurrency: input.grossProfitCurrency || "",
    creator: input.creator || "",
    ...(input.deskSeat ? { deskSeat: input.deskSeat } : {}),
  };
  entry.pendingShipperDetails = registryNeedsDetails(entry);
  return entry;
}

export function partyUpdates(fields: NrsPartyFields): NrsPartyFields & { pendingShipperDetails: boolean } {
  const clean = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
  ) as NrsPartyFields;
  // Stays flagged until both parties are filled in.
  return { ...clean, pendingShipperDetails: !(clean.shipperName && clean.consigneeName) };
}
