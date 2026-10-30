/**
 * Saved drafts: a desk's work in progress, parked while the user waits for a rate or a detail.
 * A draft is NOT a quote — it never reaches Enquiry DB or any count. It is stored in the same shape a saved quote
 * uses (`details`), so "Continue" reopens it through the very same loader that Amend and Duplicate use.
 */
import type { SavedQuote } from "@/lib/types";
import { belongsToViewersDesk } from "@/lib/auth/desk-seats";
import { serializeAirlineOption, serializeLinerOption, type AirlineOption, type LinerOption } from "@/lib/pricing/carrier-options";

export type DraftMode = "air" | "sea";

export interface DraftRow {
  id: string;
  mode: DraftMode;
  /** Desk seat and login that parked it — drafts stay with the desk, not the person. */
  seat: string;
  creator: string;
  customer: string;
  route: string;
  /** "Waiting for what?" — optional, one line. */
  waitingFor: string;
  /** The desk's state, in the shape a saved quote uses. */
  quote: SavedQuote;
  /** Which step the desk was on, so Continue lands there. */
  step: string;
  savedAt: number;
}

interface CommonState {
  customer: string;
  origin: string;
  destination: string;
  currency: string;
  incoterm: string;
  module: string;
  dimUnit: string;
  customFx: number;
  terms: string;
  creator: string;
  localOriginCharges: unknown;
  destClearanceCharges: unknown;
}

export function buildAirDraftQuote(s: CommonState & { commodity: string; cargo: unknown; airlines: AirlineOption[]; lanes: unknown }): SavedQuote {
  return {
    id: "",
    customer: s.customer,
    creator: s.creator,
    status: "draft",
    type: "air",
    currency: s.currency,
    details: {
      origin: s.origin,
      destination: s.destination,
      incoterm: s.incoterm,
      commodity: s.commodity,
      module: s.module,
      dimUnit: s.dimUnit,
      cargoItems: s.cargo,
      airlines: s.airlines.map(serializeAirlineOption),
      lanes: s.lanes,
      localOriginCharges: s.localOriginCharges,
      destClearanceCharges: s.destClearanceCharges,
      termsAndConditions: s.terms,
      customExchangeRate: s.customFx || 0,
    },
  };
}

export function buildSeaDraftQuote(
  s: CommonState & { shippingMode: string; grossWeightKg: number; volumeCbm: number; cargo: unknown; chargeableCbmOverride: number; liners: LinerOption[] },
): SavedQuote {
  return {
    id: "",
    customer: s.customer,
    creator: s.creator,
    status: "draft",
    type: "sea",
    currency: s.currency,
    details: {
      origin: s.origin,
      destination: s.destination,
      incoterm: s.incoterm,
      module: s.module,
      shippingMode: s.shippingMode,
      grossWeight: s.grossWeightKg,
      volumeCbm: s.volumeCbm,
      seaCargoItems: s.cargo,
      dimUnit: s.dimUnit,
      chargeableCbmOverride: s.chargeableCbmOverride,
      customExchangeRate: s.customFx || 0,
      liners: s.liners.map(serializeLinerOption),
      localOriginCharges: s.localOriginCharges,
      destClearanceCharges: s.destClearanceCharges,
      termsAndConditions: s.terms,
    },
  };
}

/** "TATA STEEL · BLR → DXB" — a blank customer still reads as something. */
export function draftTitle(customer: string, origin: string, destination: string): { customer: string; route: string } {
  const code = (p: string) => (p.split(" - ")[0] || "").trim();
  const o = code(origin);
  const d = code(destination);
  return { customer: customer.trim() || "No customer yet", route: o || d ? `${o || "?"} → ${d || "?"}` : "No route yet" };
}

/** A draft belongs to a desk: its holder sees it, whoever parked it; other logins see only their own. */
export function draftsForViewer(rows: DraftRow[], username: string | undefined | null, mode?: DraftMode): DraftRow[] {
  return rows
    .filter((r) => (!mode || r.mode === mode) && belongsToViewersDesk({ deskSeat: r.seat, creator: r.creator }, username))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Amber once a draft has sat for 3 days. */
export function draftIsStale(savedAt: number, now: number = Date.now()): boolean {
  return now - savedAt >= 3 * 86_400_000;
}

export function draftAge(savedAt: number, now: number = Date.now()): string {
  const days = Math.floor((now - savedAt) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
