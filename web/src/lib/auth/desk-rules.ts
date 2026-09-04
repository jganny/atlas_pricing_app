/**
 * Desk category rules — NRS / Free Hand vs Nomination.
 */

import { TEAM_ROLES } from "@/lib/quotes/team-roles";

export function deskCategory(username: string | undefined | null): string {
  const u = (username || "").toLowerCase().trim();
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

export function defaultDeskCurrency(username: string | undefined | null): string {
  const cat = deskCategory(username);
  if (cat.includes("NRS") || cat.includes("FREE HAND")) return "INR";
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
