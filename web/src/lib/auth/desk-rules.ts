/**
 * Desk category rules — NRS / Free Hand vs Nomination.
 */

import { activeSeatForLogin, type DeskSeatId } from "@/lib/auth/desk-seats";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";

/** The rules belong to the desk, so whoever sits in the seat gets that desk's category. */
const SEAT_CATEGORY: Partial<Record<DeskSeatId, string>> = {
  "air-nom": "AIR - NOMINATION",
  "sea-nom": "SEA - NOMINATION",
  nrs: "NRS (AIR/SEA)",
  freehand: "FREE HAND SALES (AIR/SEA)",
};

export function deskCategory(username: string | undefined | null): string {
  const u = (username || "").toLowerCase().trim();
  const seat = activeSeatForLogin(u);
  const fromSeat = seat ? SEAT_CATEGORY[seat.id] : undefined;
  if (fromSeat) return fromSeat;
  return TEAM_ROLES[u]?.category || "";
}

/** Hide agency-agreement compliance UI for NRS and Free Hand. */
export function shouldHideAgencyAgreement(username: string | undefined | null): boolean {
  const cat = deskCategory(username);
  return (
    cat === "NRS (AIR/SEA)" ||
    cat === "FREE HAND SALES (AIR/SEA)"
  );
}

/**
 * Starting currency only — every desk can still pick any of DESK_CURRENCIES
 * (USD/EUR/GBP/INR) from the same dropdown, NRS and Free Hand included. This
 * only decides which one is pre-selected when a fresh quote opens, matching
 * legacy's own TEAM_ROLES currency field exactly: NRS quotes internationally
 * (USD), Free Hand is domestic (INR) — they are not the same default.
 */
export function defaultDeskCurrency(username: string | undefined | null): string {
  const cat = deskCategory(username);
  if (cat.includes("FREE HAND")) return "INR";
  return "USD";
}

export function defaultIncoterm(username: string | undefined | null): string {
  const cat = deskCategory(username);
  if (cat.includes("NRS")) return "EXW";
  return "CIF";
}

export function showBuyRates(username: string | undefined | null): boolean {
  const cat = deskCategory(username);
  // Nomination desks see buy; free hand / NRS often sell-focused
  return (
    cat === "AIR - NOMINATION" ||
    cat === "SEA - NOMINATION" ||
    !cat
  );
}
