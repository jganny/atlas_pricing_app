/**
 * Custom dropdown entries — names people typed that the built-in lists don't
 * have (customers, ports, airlines, shipping lines, commodities). Same eight
 * list types, and the same `custom_autocomplete_entries` documents, the
 * original app used, so everything added there shows up here too.
 *
 * Reads come from a local copy kept fresh by the shared database (live mode);
 * `setCustomEntryWriter` connects new entries back to it.
 */

export const CUSTOM_ENTRY_TYPES = [
  "customers",
  "airports",
  "airlines",
  "seaports",
  "shippinglines",
  "linernames",
  "sea_commodities",
  "air_commodities",
] as const;
export type CustomEntryType = (typeof CUSTOM_ENTRY_TYPES)[number];

/** Ports are stored as { code, name }; everything else is a plain name. */
export type CustomEntry = string | { code: string; name: string };

const KEY = "atlas_custom_entries_v1";

let cache: Partial<Record<CustomEntryType, CustomEntry[]>> | null = null;
let version = 0;
const listeners = new Set<() => void>();
let writer: ((type: CustomEntryType, entry: CustomEntry) => void) | null = null;

function load(): Partial<Record<CustomEntryType, CustomEntry[]>> {
  if (cache) return cache;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function persist() {
  version += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache ?? {}));
  } catch {
    /* private mode — the in-memory copy still works */
  }
  listeners.forEach((l) => l());
}

export function isCustomEntryType(t: string): t is CustomEntryType {
  return (CUSTOM_ENTRY_TYPES as readonly string[]).includes(t);
}

export function getCustomEntries(type: CustomEntryType): CustomEntry[] {
  return load()[type] ?? [];
}

/** Plain-name lists (customers, airlines, lines, commodities). */
export function customNames(type: CustomEntryType): string[] {
  return getCustomEntries(type).map((e) => (typeof e === "string" ? e : e.name)).filter(Boolean);
}

export function customPorts(type: "airports" | "seaports"): Array<{ code: string; name: string }> {
  return getCustomEntries(type).flatMap((e) => (typeof e === "string" ? [{ code: e.toUpperCase().slice(0, 6), name: e }] : [e]));
}

const keyOf = (e: CustomEntry) => (typeof e === "string" ? e : `${e.code} ${e.name}`).trim().toLowerCase();

/** Replaces one list with what the shared database holds. */
export function applyRemoteCustomEntries(type: CustomEntryType, entries: CustomEntry[]) {
  const clean = entries.filter((e) => (typeof e === "string" ? e.trim() : e && (e.code || e.name)));
  const now = JSON.stringify(load()[type] ?? []);
  if (JSON.stringify(clean) === now) return;
  load()[type] = clean;
  persist();
}

/** Remembers a new name (ignored when empty or already known) and shares it. Returns whether it was new. */
export function rememberCustomEntry(type: CustomEntryType, value: string): boolean {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) return false;
  const list = load()[type] ?? [];
  if (list.some((e) => keyOf(e) === name.toLowerCase() || (typeof e !== "string" && e.name.toLowerCase() === name.toLowerCase()))) {
    return false;
  }
  load()[type] = [...list, name];
  persist();
  writer?.(type, name);
  return true;
}

export function setCustomEntryWriter(next: ((type: CustomEntryType, entry: CustomEntry) => void) | null) {
  writer = next;
}

export function subscribeCustomEntries(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getCustomEntriesVersion(): number {
  return version;
}

/** Test helper — forgets the in-memory copy. */
export function resetCustomEntriesForTests() {
  cache = null;
  version = 0;
}
