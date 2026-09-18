/**
 * Sales Module permissions — enforced in the app only for leads/activities
 * (Firestore rules on those two collections are left open because the legacy
 * app also writes them). Accounts/contacts/targets/territories additionally
 * have real ownership rules in firestore.rules.
 */

import { isAdminUser } from "@/lib/quotes/team-roles";
import type { Account, SalesLead } from "@/lib/types";

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/**
 * Admins edit anything. Everyone else edits only their own leads. A lead with
 * no owner (typically created in the legacy app) stays editable by any signed-in
 * user so existing data can never be locked out.
 */
export function canEditLead(
  username: string | undefined | null,
  role: string | undefined,
  lead: Pick<SalesLead, "owner">,
): boolean {
  if (!username) return false;
  if (isAdminUser(username, role)) return true;
  const owner = norm(lead.owner);
  return !owner || owner === norm(username);
}

/** One unified record (lead == opportunity), so the same rule applies. */
export const canEditOpportunity = canEditLead;

/** Deleting is destructive — admin only. */
export function canDeleteLead(username: string | undefined | null, role?: string): boolean {
  return isAdminUser(username, role);
}

/** Mirrors the firestore.rules ownership rule on `accounts` / `salesContacts`. */
export function canEditAccount(
  username: string | undefined | null,
  role: string | undefined,
  account: Pick<Account, "owner">,
): boolean {
  if (!username) return false;
  return isAdminUser(username, role) || norm(account.owner) === norm(username);
}

export function canManageSalesTargets(username: string | undefined | null, role?: string): boolean {
  return isAdminUser(username, role);
}

export function canManageTerritories(username: string | undefined | null, role?: string): boolean {
  return isAdminUser(username, role);
}
