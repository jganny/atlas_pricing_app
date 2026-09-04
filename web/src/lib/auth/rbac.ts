/**
 * Phase 10–14 route access. Admins see everything.
 */

import { isAdminUser, TEAM_ROLES } from "@/lib/quotes/team-roles";

export type AppRouteId =
  | "dashboard"
  | "air"
  | "sea"
  | "courier"
  | "transport"
  | "warehouse"
  | "inbox"
  | "enquiries"
  | "circulars"
  | "directory"
  | "sales"
  | "admin"
  | "analytics"
  | "ops"
  | "docs"
  | "finance"
  | "hr"
  | "feature-parity"
  | "smart-quote";

const ALL: AppRouteId[] = [
  "dashboard",
  "air",
  "sea",
  "courier",
  "transport",
  "warehouse",
  "inbox",
  "enquiries",
  "circulars",
  "directory",
  "sales",
  "admin",
  "analytics",
  "ops",
  "docs",
  "finance",
  "hr",
  "feature-parity",
  "smart-quote",
];

const CORE: AppRouteId[] = [
  "dashboard",
  "air",
  "sea",
  "courier",
  "transport",
  "warehouse",
  "inbox",
  "enquiries",
  "circulars",
  "directory",
  "sales",
  "docs",
];

/** Per-login allowed surfaces (admins bypass). */
const ROLE_ROUTES: Record<string, AppRouteId[]> = {
  shashank: [
    "dashboard",
    "air",
    "transport",
    "warehouse",
    "inbox",
    "enquiries",
    "circulars",
    "directory",
    "sales",
    "docs",
  ],
  shaheer: [
    "dashboard",
    "sea",
    "transport",
    "warehouse",
    "inbox",
    "enquiries",
    "circulars",
    "directory",
    "sales",
    "docs",
  ],
  kavya: [...CORE],
  jaya: [...CORE],
  cathrina: [...CORE, "admin"],
  pricing: [
    "dashboard",
    "air",
    "sea",
    "inbox",
    "enquiries",
    "circulars",
    "directory",
    "docs",
  ],
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
  if (TEAM_ROLES[u]?.type === "member") return CORE;
  return ALL;
}

export function canAccessRoute(
  username: string | undefined | null,
  role: string | undefined,
  route: AppRouteId,
): boolean {
  return allowedRoutesForUser(username, role).includes(route);
}

export function routeIdFromPath(pathname: string): AppRouteId | null {
  const p =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (p === "/" || p === "") return "dashboard";
  if (p.startsWith("/air")) return "air";
  if (p.startsWith("/sea")) return "sea";
  if (p.startsWith("/courier")) return "courier";
  if (p.startsWith("/transport")) return "transport";
  if (p.startsWith("/warehouse")) return "warehouse";
  if (p.startsWith("/inbox")) return "inbox";
  if (p.startsWith("/enquiries")) return "enquiries";
  if (p.startsWith("/circulars")) return "circulars";
  if (p.startsWith("/directory")) return "directory";
  if (p.startsWith("/sales")) return "sales";
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/analytics")) return "analytics";
  if (p.startsWith("/ops")) return "ops";
  if (p.startsWith("/docs")) return "docs";
  if (p.startsWith("/finance")) return "finance";
  if (p.startsWith("/hr")) return "hr";
  if (p.startsWith("/feature-parity")) return "feature-parity";
  if (p.startsWith("/smart-quote")) return "smart-quote";
  return null;
}

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
