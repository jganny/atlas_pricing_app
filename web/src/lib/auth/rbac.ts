/**
 * Phase 11 — Role-based access for Atlas desks.
 * Soft UI RBAC: hide nav + soft-block routes. Admins see everything.
 */

import { isAdminUser, TEAM_ROLES } from "@/lib/quotes/team-roles";

export type AppRouteId =
  | "dashboard"
  | "air"
  | "sea"
  | "courier"
  | "inbox"
  | "enquiries"
  | "circulars"
  | "directory"
  | "feature-parity"
  | "smart-quote";

const ALL: AppRouteId[] = [
  "dashboard",
  "air",
  "sea",
  "courier",
  "inbox",
  "enquiries",
  "circulars",
  "directory",
  "feature-parity",
  "smart-quote",
];

/** Per-login allowed surfaces (admins bypass). */
const ROLE_ROUTES: Record<string, AppRouteId[]> = {
  shashank: ["dashboard", "air", "inbox", "enquiries", "circulars", "directory"],
  shaheer: ["dashboard", "sea", "inbox", "enquiries", "circulars", "directory"],
  kavya: ["dashboard", "air", "sea", "courier", "inbox", "enquiries", "circulars", "directory"],
  jaya: ["dashboard", "air", "sea", "courier", "inbox", "enquiries", "circulars", "directory"],
  cathrina: ["dashboard", "air", "sea", "courier", "inbox", "enquiries", "circulars", "directory"],
  pricing: ["dashboard", "air", "sea", "inbox", "enquiries", "circulars", "directory"],
  preview: ALL,
};

export function normalizeUsername(username: string | undefined | null): string {
  return (username || "").toLowerCase().trim();
}

export function allowedRoutesForUser(
  username: string | undefined | null,
  role?: string,
): AppRouteId[] {
  if (isAdminUser(username, role)) return ALL;
  const u = normalizeUsername(username);
  if (ROLE_ROUTES[u]) return ROLE_ROUTES[u];
  // Unknown member — give core desks so they are not locked out
  if (TEAM_ROLES[u]?.type === "member") {
    return ["dashboard", "air", "sea", "inbox", "enquiries", "circulars", "directory"];
  }
  return ALL;
}

export function canAccessRoute(
  username: string | undefined | null,
  role: string | undefined,
  route: AppRouteId,
): boolean {
  return allowedRoutesForUser(username, role).includes(route);
}

/** Map pathname → route id for guards. */
export function routeIdFromPath(pathname: string): AppRouteId | null {
  const p =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (p === "/" || p === "") return "dashboard";
  if (p.startsWith("/air")) return "air";
  if (p.startsWith("/sea")) return "sea";
  if (p.startsWith("/courier")) return "courier";
  if (p.startsWith("/inbox")) return "inbox";
  if (p.startsWith("/enquiries")) return "enquiries";
  if (p.startsWith("/circulars")) return "circulars";
  if (p.startsWith("/directory")) return "directory";
  if (p.startsWith("/feature-parity")) return "feature-parity";
  if (p.startsWith("/smart-quote")) return "smart-quote";
  return null;
}

/** Best landing page after login for this person. */
export function preferredHomePath(
  username: string | undefined | null,
  role?: string,
): string {
  const u = normalizeUsername(username);
  if (isAdminUser(username, role)) return "/";
  if (u === "shashank") return "/air/";
  if (u === "shaheer") return "/sea/";
  if (u === "kavya" || u === "jaya" || u === "cathrina") return "/inbox/";
  return "/";
}

export function deskFocusLabel(username: string | undefined | null): string {
  const u = normalizeUsername(username);
  if (u === "shashank") return "Air Nomination";
  if (u === "shaheer") return "Sea Nomination";
  if (u === "kavya" || u === "jaya") return "Free Hand";
  if (u === "cathrina") return "NRS";
  if (isAdminUser(username)) return "Admin";
  return TEAM_ROLES[u]?.name || "Desk";
}
