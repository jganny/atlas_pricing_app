/**
 * Directory edit/view rights — mirrors legacy app-v4.js
 * canEditAgentsDirectory / canAccessVendorsDirectory.
 */

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

export function isAgencyContact(category: string | undefined): boolean {
  return (category || "").toLowerCase() === "agency";
}
