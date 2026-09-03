/** Desk roles — mirrors legacy TEAM_ROLES for ownership labels/filters. */

export interface TeamRole {
  name: string;
  type: "admin" | "member";
  category?: string;
}

export const TEAM_ROLES: Record<string, TeamRole> = {
  ganny: { name: "Pricing Team", type: "admin" },
  shashank: { name: "Air Nom", type: "member", category: "AIR - NOMINATION" },
  shaheer: { name: "Sea Nomination", type: "member", category: "SEA - NOMINATION" },
  jaya: { name: "Free Hand", type: "member", category: "FREE HAND SALES (AIR/SEA)" },
  cathrina: { name: "NRS", type: "member", category: "NRS (AIR/SEA)" },
  manager: { name: "Manager", type: "admin" },
  pricing: { name: "Pricing Agent", type: "member" },
};

const ADMIN_USERNAMES = new Set(["ganny", "manager", "admin"]);

export function deskDisplayName(creator: string | undefined | null): string {
  if (!creator) return "—";
  const key = creator.toLowerCase();
  return TEAM_ROLES[key]?.name || creator;
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
