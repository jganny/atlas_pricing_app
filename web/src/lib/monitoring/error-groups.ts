/** Turns raw error records into "distinct problems" for the admin screen (pure, testable). */

export interface ClientErrorRecord {
  id: string;
  atIso: string;
  actor: string;
  fingerprint: string;
  message: string;
  stack: string;
  componentStack: string;
  source: string;
  path: string;
  version: string;
  userAgent: string;
}

export interface ErrorGroup {
  fingerprint: string;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  versions: string[];
  users: string[];
  paths: string[];
  stack: string;
  componentStack: string;
  ids: string[];
}

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

export function groupErrors(records: ClientErrorRecord[]): ErrorGroup[] {
  const map = new Map<string, ClientErrorRecord[]>();
  for (const r of records) {
    const list = map.get(r.fingerprint) ?? [];
    list.push(r);
    map.set(r.fingerprint, list);
  }
  const groups: ErrorGroup[] = [];
  for (const [fingerprint, list] of map) {
    const sorted = [...list].sort((a, b) => a.atIso.localeCompare(b.atIso));
    const newest = sorted[sorted.length - 1]!;
    groups.push({
      fingerprint,
      message: newest.message,
      count: list.length,
      firstSeen: sorted[0]!.atIso,
      lastSeen: newest.atIso,
      versions: uniq(sorted.map((r) => r.version)),
      users: uniq(sorted.map((r) => r.actor)),
      paths: uniq(sorted.map((r) => r.path)),
      stack: newest.stack,
      componentStack: newest.componentStack,
      ids: list.map((r) => r.id),
    });
  }
  return groups.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/** Records newer than `hours` ago (ISO strings compare correctly as text). */
export function withinHours(records: ClientErrorRecord[], hours: number, now: number = Date.now()): ClientErrorRecord[] {
  const cutoff = new Date(now - hours * 3_600_000).toISOString();
  return records.filter((r) => r.atIso >= cutoff);
}
