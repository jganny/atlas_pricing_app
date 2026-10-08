/**
 * The weekly Overseas Agents upload — what it replaces, what it removes, what it leaves alone.
 * Pure (no Firebase) so the rules can be tested and shown to the user before anything is deleted.
 *
 * Rules:
 *  - The uploaded file is the authority: last week's imported agents are replaced by it.
 *  - An agent listed twice in the file is kept once (the fuller row, else the later one).
 *  - An agent already on the list (added by hand, or by an older import) that is also in the file
 *    is replaced by the new row; any further copies of it are removed.
 *  - Repeats of the same agent among the remaining hand-added agents are removed (newest kept).
 *  - Hand-added agents that are not in the file are never touched.
 */
import type { DirectoryContact } from "@/lib/types";

type AgentLike = Pick<DirectoryContact, "name" | "email" | "location">;

const LEGAL_WORDS = new Set([
  "ltd", "limited", "llc", "llp", "lp", "inc", "incorporated", "corp", "corporation", "co", "company",
  "pte", "pvt", "private", "plc", "gmbh", "ag", "bv", "nv", "sa", "sas", "srl", "spa", "sdn", "bhd",
  "fze", "fzco", "fzc", "ou", "oy", "ab", "as", "aps", "kg", "ooo", "jsc", "pjsc", "the",
]);

/** "ABC Logistics Co., Ltd." and "abc logistics co ltd" and "A.B.C. Logistics Limited" → the same key. */
export function normalizeAgentName(name: string): string {
  const words = (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  // "a b c" (from "A.B.C.") joins back into one word.
  const joined: string[] = [];
  let singles = "";
  for (const w of words) {
    if (w.length === 1) singles += w;
    else {
      if (singles) joined.push(singles);
      singles = "";
      joined.push(w);
    }
  }
  if (singles) joined.push(singles);
  return joined.filter((w) => !LEGAL_WORDS.has(w)).join(" ");
}

function locationTokens(loc: string | undefined): Set<string> {
  return new Set(
    (loc || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 1),
  );
}

/** Same company: same name once tidied, and the place doesn't contradict (or the email matches). */
export function sameAgent(a: AgentLike, b: AgentLike): boolean {
  const na = normalizeAgentName(a.name);
  if (!na || na !== normalizeAgentName(b.name)) return false;
  const ea = (a.email || "").trim().toLowerCase();
  const eb = (b.email || "").trim().toLowerCase();
  if (ea && ea === eb) return true;
  const la = locationTokens(a.location);
  const lb = locationTokens(b.location);
  if (la.size === 0 || lb.size === 0) return true;
  return [...la].some((t) => lb.has(t));
}

function filled(c: Partial<DirectoryContact>): number {
  return [c.contactPerson, c.email, c.phone, c.location, c.notes, c.sheetGroup, c.agreement].filter((v) => (v || "").trim()).length;
}

/**
 * Groups the same company together. Rows are first bucketed by their tidied name (one pass), and
 * only rows in the same bucket are compared — so a list of thousands stays instant.
 */
function cluster<T extends AgentLike>(items: T[]): T[][] {
  const buckets = new Map<string, T[][]>();
  const order: T[][][] = [];
  for (const item of items) {
    const key = normalizeAgentName(item.name);
    let groups = buckets.get(key);
    if (!groups) {
      groups = [];
      buckets.set(key, groups);
      order.push(groups);
    }
    const g = groups.find((grp) => grp.some((x) => sameAgent(x, item)));
    if (g) g.push(item);
    else groups.push([item]);
  }
  return order.flat();
}

export type AgencyImportPlan<I extends AgentLike & Partial<DirectoryContact>> = {
  /** The file's rows after repeats are dropped. */
  incoming: I[];
  /** Names that appeared more than once in the file. */
  fileRepeats: string[];
  /** Existing agent rows to delete. */
  deleteIds: string[];
  /** For rows in `incoming`: the existing hand-added row they take over, by index. */
  absorbIdByIndex: Record<number, string>;
  /** Last week's imported rows being replaced. */
  previousImportRemoved: number;
  /** Names of older copies removed because the new file (or another entry) already covers them. */
  oldDuplicatesRemoved: string[];
  /** Hand-added agents not in the file — left alone. */
  manualKept: number;
};

export function planAgencyImport<I extends AgentLike & Partial<DirectoryContact>>(
  existing: DirectoryContact[],
  file: I[],
): AgencyImportPlan<I> {
  // 1. Repeats inside the file.
  const fileRepeats: string[] = [];
  const groups = cluster(file.filter((r) => (r.name || "").trim()));
  const incoming = groups.map((g) => {
    if (g.length > 1) fileRepeats.push(g[0].name.trim());
    // the fuller row wins; on a tie, the later one
    return g.reduce((best, r) => (filled(r) >= filled(best) ? r : best));
  });

  // 2. Existing agents.
  const agents = existing.filter((c) => (c.category || "").toLowerCase() === "agency");
  const imported = agents.filter((c) => c.importBatchId);
  const handOrOld = agents.filter((c) => !c.importBatchId);
  const deleteIds = imported.map((c) => c.id);
  const absorbIdByIndex: Record<number, string> = {};
  const oldDuplicatesRemoved: string[] = [];
  const used = new Set<string>();

  const keepOrder = (a: DirectoryContact, b: DirectoryContact) =>
    Number(Boolean(b.agreementUrl)) - Number(Boolean(a.agreementUrl)) ||
    (b.updatedAt || "").localeCompare(a.updatedAt || "");

  const existingByName = new Map<string, DirectoryContact[]>();
  for (const m of handOrOld) {
    const k = normalizeAgentName(m.name);
    existingByName.set(k, [...(existingByName.get(k) ?? []), m]);
  }
  incoming.forEach((row, i) => {
    const matches = (existingByName.get(normalizeAgentName(row.name)) ?? [])
      .filter((m) => !used.has(m.id) && sameAgent(m, row))
      .sort(keepOrder);
    if (!matches.length) return;
    absorbIdByIndex[i] = matches[0].id;
    matches.forEach((m) => used.add(m.id));
    for (const extra of matches.slice(1)) {
      deleteIds.push(extra.id);
      oldDuplicatesRemoved.push(extra.name.trim());
    }
  });

  // 3. Repeats among the hand-added agents the file doesn't mention.
  const rest = handOrOld.filter((m) => !used.has(m.id));
  let manualKept = 0;
  for (const g of cluster(rest)) {
    const sorted = [...g].sort(keepOrder);
    manualKept += 1;
    for (const extra of sorted.slice(1)) {
      deleteIds.push(extra.id);
      oldDuplicatesRemoved.push(extra.name.trim());
    }
  }

  return {
    incoming,
    fileRepeats,
    deleteIds,
    absorbIdByIndex,
    previousImportRemoved: imported.length,
    oldDuplicatesRemoved,
    manualKept,
  };
}

/** Plain-language summary shown before the upload goes ahead. */
export function describeAgencyPlan(plan: AgencyImportPlan<AgentLike & Partial<DirectoryContact>>): string {
  const list = (names: string[]) =>
    names.length ? ` (${names.slice(0, 6).join(", ")}${names.length > 6 ? `, +${names.length - 6} more` : ""})` : "";
  const lines = [
    `This upload has ${plan.incoming.length} agents.`,
    plan.previousImportRemoved ? `Last week's list (${plan.previousImportRemoved} agents) will be replaced by it.` : "",
    plan.fileRepeats.length ? `Listed more than once in the file, kept once: ${plan.fileRepeats.length}${list(plan.fileRepeats)}.` : "",
    Object.keys(plan.absorbIdByIndex).length
      ? `Already on your list and now updated from the file: ${Object.keys(plan.absorbIdByIndex).length}.`
      : "",
    plan.oldDuplicatesRemoved.length
      ? `Older duplicate entries that will be deleted: ${plan.oldDuplicatesRemoved.length}${list(plan.oldDuplicatesRemoved)}.`
      : "No older duplicates found.",
    plan.manualKept ? `Agents you added by hand that aren't in the file stay as they are: ${plan.manualKept}.` : "",
    "",
    "Continue?",
  ];
  return lines.filter((l, i) => l || i === lines.length - 2).join("\n");
}
