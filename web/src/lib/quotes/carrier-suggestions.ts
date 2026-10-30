/**
 * "Vertex suggests": the airlines or liners this desk has actually quoted on a lane before, most-used first.
 * Built only from the quotes already in Enquiry DB — nothing is guessed and nothing is chosen for the user.
 */
import type { EnquiryRecord } from "@/lib/types";

export interface CarrierSuggestion {
  name: string;
  uses: number;
  /** Timestamp (ms) of the most recent quote that used it. */
  lastUsed: number;
  hasTariff: boolean;
}

/** "BLR", "BLR - Bangalore" and "Bangalore (BLR)" all give BLR. */
export function placeCode(place: string | undefined | null): string {
  const p = String(place ?? "").trim();
  const paren = /\(([A-Za-z]{3,5})\)/.exec(p);
  if (paren) return paren[1].toUpperCase();
  return (p.split(" - ")[0] || "").trim().toUpperCase();
}

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function suggestCarriers(input: {
  enquiries: EnquiryRecord[];
  mode: "air" | "sea";
  origin: string;
  destination: string;
  hasTariff: (carrierName: string) => boolean;
}): CarrierSuggestion[] {
  const o = placeCode(input.origin);
  const d = placeCode(input.destination);
  if (!o || !d) return [];
  const tally = new Map<string, { names: Map<string, number>; uses: number; lastUsed: number }>();
  for (const e of input.enquiries) {
    if (e.mode !== input.mode || e.status === "cancelled") continue;
    const legs = e.legs?.length ? e.legs : [{ origin: e.origin, destination: e.destination, carrier: e.carrier ?? "" }];
    const when = Date.parse(e.createdAt) || 0;
    for (const leg of legs) {
      const name = String(leg.carrier ?? "").trim();
      if (!name || placeCode(leg.origin) !== o || placeCode(leg.destination) !== d) continue;
      const slot = tally.get(key(name)) ?? { names: new Map(), uses: 0, lastUsed: 0 };
      slot.uses += 1;
      slot.lastUsed = Math.max(slot.lastUsed, when);
      slot.names.set(name, (slot.names.get(name) ?? 0) + 1);
      tally.set(key(name), slot);
    }
  }
  return [...tally.values()]
    .map((s) => {
      // Show the spelling people use most for this carrier.
      const name = [...s.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { name, uses: s.uses, lastUsed: s.lastUsed, hasTariff: input.hasTariff(name) };
    })
    .sort((a, b) => b.uses - a.uses || b.lastUsed - a.lastUsed);
}

/** "today", "3 days ago", "2 months ago" */
export function agoLabel(timestamp: number, now: number = Date.now()): string {
  if (!timestamp) return "";
  const days = Math.max(0, Math.floor((now - timestamp) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
