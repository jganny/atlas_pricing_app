/** Desk roles — mirrors legacy TEAM_ROLES for ownership labels/filters. */

import { enquiryAssigneeLabel, seatForLogin } from "@/lib/auth/desk-seats";
import { IS_DEMO_BUILD } from "@/lib/demo-mode";
import { REAL_NAMES, REAL_MAILBOX_EMAILS, REAL_IMAP_HOST } from "@/lib/quotes/team-roles-real-names";

export interface TeamRole {
  name: string;
  type: "admin" | "member";
  category?: string;
}

// Role metadata lives here; real display names live in the sibling
// team-roles-real-names.ts file, which scripts/build-demo.sh physically
// replaces with a demo-safe stub before compiling — so the demo build never
// has the real names in its source at all, not just unreferenced at runtime.
type RoleMeta = { type: "admin" | "member"; category?: string };

const ROLE_META: Record<string, RoleMeta> = {
  ganny: { type: "admin" },
  shashank: { type: "member", category: "AIR - NOMINATION" },
  shaheer: { type: "member", category: "SEA - NOMINATION" },
  kavya: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  jaya: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  cathrina: { type: "member", category: "NRS (AIR/SEA)" },
  manager: { type: "admin" },
  pricing: { type: "member" },
  sunil: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  ramesh: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  goutham: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  spoorthi: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  linson: { type: "member", category: "FREE HAND SALES (AIR/SEA)" },
};

// Keep these in sync with DEMO_SEAT_LABELS/DEMO_PERSON_NAMES in
// lib/auth/desk-seats.ts — same ids, shown through two separate code paths,
// so the wording should match wherever they overlap.
const DEMO_NAMES: Record<string, string> = {
  ganny: "Admin",
  shashank: "Air Desk",
  shaheer: "Sea Desk",
  kavya: "Independent Sales",
  jaya: "Independent Sales",
  cathrina: "Priority Desk",
  manager: "Manager",
  pricing: "Pricing Agent",
  sunil: "Sales Rep A",
  ramesh: "Sales Rep B",
  goutham: "Sales Rep C",
  spoorthi: "Sales Rep D",
  linson: "Sales Rep E",
};

const NAMES: Record<string, string> = IS_DEMO_BUILD ? DEMO_NAMES : REAL_NAMES;

export const TEAM_ROLES: Record<string, TeamRole> = Object.fromEntries(
  Object.entries(ROLE_META).map(([id, meta]) => [id, { ...meta, name: NAMES[id] ?? id }]),
);

/** Demo-build-only stand-in for a raw login id — a few admin screens show the
 * username right next to the display name (e.g. "Sales Rep A (sunil)"),
 * which would leak the real login even after the name itself is swapped. */
const DEMO_IDS: Record<string, string> = {
  ganny: "admin", shashank: "air-nom", shaheer: "sea-nom", kavya: "sales-1", jaya: "sales-1",
  cathrina: "priority-desk", manager: "manager", pricing: "pricing", sunil: "sales-a",
  ramesh: "sales-b", goutham: "sales-c", spoorthi: "sales-d", linson: "sales-e",
};

export function demoSafeId(id: string): string {
  return IS_DEMO_BUILD ? DEMO_IDS[id] ?? id : id;
}

/** Shared company mailboxes → who works that inbox (login ids). */
export const ATLAS_IMAP = {
  host: IS_DEMO_BUILD ? "imap.example.com" : (REAL_IMAP_HOST as string),
  port: 993,
  secure: true,
  folder: "INBOX",
} as const;

export const MAILBOX_TEAMS = {
  pricing: {
    key: "pricing" as const,
    email: IS_DEMO_BUILD ? "pricing@example.com" : REAL_MAILBOX_EMAILS.pricing,
    users: ["shashank", "shaheer"] as const,
    desks: ["AIR - NOMINATION", "SEA - NOMINATION"] as const,
  },
  pricingsales: {
    key: "pricingsales" as const,
    email: IS_DEMO_BUILD ? "sales@example.com" : REAL_MAILBOX_EMAILS.pricingsales,
    users: ["kavya", "cathrina"] as const,
    desks: ["FREE HAND SALES (AIR/SEA)", "NRS (AIR/SEA)"] as const,
  },
  monitor: {
    key: "monitor" as const,
    email: IS_DEMO_BUILD ? "admin@example.com" : REAL_MAILBOX_EMAILS.monitor,
    users: ["ganny"] as const,
    desks: ["ADMIN MONITOR"] as const,
  },
} as const;

export type MailboxKey = keyof typeof MAILBOX_TEAMS;

const ADMIN_USERNAMES = new Set(["ganny", "manager", "admin"]);

export function deskDisplayName(creator: string | undefined | null): string {
  if (!creator) return "—";
  const key = creator.toLowerCase();
  const seat = seatForLogin(key);
  if (seat) return enquiryAssigneeLabel(key);
  return TEAM_ROLES[key]?.name || enquiryAssigneeLabel(key);
}

export function isAdminUser(username: string | undefined | null, role?: string): boolean {
  if (!username) return false;
  const u = username.toLowerCase();
  if (ADMIN_USERNAMES.has(u)) return true;
  if (role === "ganny" || role === "manager") return true;
  return TEAM_ROLES[u]?.type === "admin";
}

export function listDeskFilterOptions(creatorsFromData: string[] = []): Array<{ id: string; label: string }> {
  const ids = new Set<string>([
    ...Object.keys(TEAM_ROLES),
    ...creatorsFromData.map((c) => c.toLowerCase()).filter(Boolean),
  ]);
  ids.delete("mahendra");
  ids.delete("jaya"); // retired login — Kavya holds Free Hand now
  return Array.from(ids)
    .sort((a, b) => deskDisplayName(a).localeCompare(deskDisplayName(b)))
    .map((id) => ({ id, label: deskDisplayName(id) }));
}

/** Match quote.creator against a selected desk filter value. */
export function matchesDeskFilter(creator: string, deskFilter: string): boolean {
  if (!deskFilter || deskFilter === "all") return true;
  if (deskFilter === "mine") return false; // handled by caller with username
  const c = (creator || "").toLowerCase();
  const target = deskFilter.toLowerCase();
  const roleName = (TEAM_ROLES[target]?.name || "").toLowerCase();
  const creatorName = deskDisplayName(creator).toLowerCase();
  return (
    c === target ||
    creatorName === target ||
    (!!roleName && (roleName.includes(creatorName) || creatorName.includes(target)))
  );
}
