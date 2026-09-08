/**
 * Phase 10–14 route access. Admins see everything.
 */

import { seatForLogin, type DeskSeatId } from "@/lib/auth/desk-seats";
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
  | "smart-quote"
  | "nrs";

/** Full admin surface — excludes NRS follow-ups (Cathrina-only queue). */
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
  "smart-quote",
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
    "smart-quote",
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
    "smart-quote",
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
  /** NRS queue is only for the NRS login — not Admin. */
  cathrina: [...CORE, "nrs"],
  pricing: [
    "dashboard",
    "smart-quote",
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

/** NRS follow-ups sidebar + route: Cathrina only. */
export function isNrsUser(username: string | undefined | null): boolean {
  return normalizeUsername(username) === "cathrina";
}

function routesForSeat(seatId: DeskSeatId): AppRouteId[] | null {
  if (seatId === "air-nom") return ROLE_ROUTES.shashank;
  if (seatId === "sea-nom") return ROLE_ROUTES.shaheer;
  if (seatId === "nrs") return ROLE_ROUTES.cathrina;
  if (seatId === "freehand") return CORE;
  if (seatId === "pricing") return ROLE_ROUTES.pricing;
  if (seatId === "admin" || seatId === "manager") return ALL;
  return null;
}

export function allowedRoutesForUser(
  username: string | undefined | null,
  role?: string,
): AppRouteId[] {
  const u = normalizeUsername(username);
  // Admins get full desk access but never the NRS personal follow-up queue.
  if (isAdminUser(username, role)) return ALL;
  const seat = seatForLogin(u);
  if (seat) {
    const fromSeat = routesForSeat(seat.id);
    if (fromSeat) return fromSeat;
  }
  if (ROLE_ROUTES[u]) return ROLE_ROUTES[u];
  if (TEAM_ROLES[u]?.type === "member") return CORE;
  // Named people (e.g. Goutham) get the desk, not Admin.
  return CORE;
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
  if (p.startsWith("/smart-quote") || p.startsWith("/quote")) return "smart-quote";
  if (p.startsWith("/nrs")) return "nrs";
  if (p.startsWith("/carriers") || p.startsWith("/integrations")) return "directory";
  if (p === "/m" || p.startsWith("/m/")) return "dashboard";
  return null;
}

export function preferredHomePath(
  username: string | undefined | null,
  role?: string,
): string {
  const u = normalizeUsername(username);
  if (isAdminUser(username, role)) return "/";
  const seat = seatForLogin(u);
  if (seat?.id === "air-nom") return "/air/";
  if (seat?.id === "sea-nom") return "/sea/";
  if (seat?.id === "nrs" || seat?.id === "freehand") return "/inbox/";
  if (u === "shashank") return "/air/";
  if (u === "shaheer") return "/sea/";
  if (u === "kavya" || u === "jaya" || u === "cathrina") return "/inbox/";
  return "/";
}

export function deskFocusLabel(username: string | undefined | null): string {
  const u = normalizeUsername(username);
  const seat = seatForLogin(u);
  if (seat) return seat.label;
  if (u === "shashank") return "Air Nomination";
  if (u === "shaheer") return "Sea Nomination";
  if (u === "kavya" || u === "jaya") return "Free Hand";
  if (u === "cathrina") return "NRS";
  if (isAdminUser(username)) return "Admin";
  return TEAM_ROLES[u]?.name || "Desk";
}
