/**
 * Directory edit/view rights — mirrors legacy app-v4.js
 * canEditAgentsDirectory / canAccessVendorsDirectory.
 */

import { activeSeatForLogin } from "@/lib/auth/desk-seats";
import { isAdminUser, TEAM_ROLES } from "@/lib/quotes/team-roles";

function roleCategory(username: string | undefined | null): string {
  const u = (username || "").toLowerCase().trim();
  return TEAM_ROLES[u]?.category || "";
}

/** Overseas Agents: Admin, Air Nom, Sea Nom. */
export function canEditAgentsDirectory(
  username: string | undefined | null,
  role?: string,
): boolean {
  if (isAdminUser(username, role)) return true;
  const cat = roleCategory(username);
  return cat === "AIR - NOMINATION" || cat === "SEA - NOMINATION";
}

/** Vendor Contacts: Admin, Air/Sea Nom, Free Hand, NRS. */
export function canAccessVendorsDirectory(
  username: string | undefined | null,
  role?: string,
): boolean {
  if (isAdminUser(username, role)) return true;
  const cat = roleCategory(username);
  return (
    cat === "AIR - NOMINATION" ||
    cat === "SEA - NOMINATION" ||
    cat === "FREE HAND SALES (AIR/SEA)" ||
    cat === "NRS (AIR/SEA)"
  );
}

/**
 * Adding and deleting circulars: Admin and the four desks (Air Nom, Sea Nom, NRS, Free Hand), by desk seat
 * so it follows whoever sits there. Individual sales logins (who share the Free Hand category) can read only.
 */
export function canManageCirculars(
  username: string | undefined | null,
  role?: string,
): boolean {
  if (isAdminUser(username, role)) return true;
  const seat = activeSeatForLogin(username)?.id;
  return seat === "air-nom" || seat === "sea-nom" || seat === "nrs" || seat === "freehand";
}

export function isAgencyContact(category: string | undefined): boolean {
  return (category || "").toLowerCase() === "agency";
}
