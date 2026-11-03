/** Reads a pasted list of people ("Asha Menon - Warehouse Chennai", "Ravi Shetty, Customs", one per line) into names and suggested logins. */

export interface StaffRow {
  name: string;
  team: string;
  username: string;
}

/** "Asha Menon" -> "asha.menon"; a single name stays whole. Letters only, lower case. */
export function suggestUsername(name: string): string {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
}

export function validUsername(u: string): boolean {
  return /^[a-z][a-z0-9._-]{2,29}$/.test(u);
}

/** One person per line; the name is what comes before " - ", a comma or a bracket; the rest is the team. Clashing logins get a number. */
export function parseStaffList(text: string, taken: Set<string> = new Set()): StaffRow[] {
  const seen = new Set(taken);
  const rows: StaffRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.replace(/^[\s\-*•\d.)]+(?=[A-Za-z])/, "").trim();
    if (!t) continue;
    const name = t.split(/\s[-–—]\s|,|\t|\(/)[0].replace(/\s+/g, " ").trim();
    if (!name) continue;
    const team = t.slice(name.length).replace(/^[\s,\-–—\t(]+/, "").replace(/\)$/, "").trim();
    const base = suggestUsername(name);
    if (!base) continue;
    let username = base;
    for (let n = 2; seen.has(username); n++) username = `${base}${n}`;
    seen.add(username);
    rows.push({ name, team, username });
  }
  return rows;
}
