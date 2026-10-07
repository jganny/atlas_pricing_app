/**
 * Duplicate detection for uploaded libraries (circulars, tariffs, directory).
 * Pure — no Firebase — so the rules can be tested. Each `plan*` function groups
 * records that are the same thing uploaded more than once and says which one to
 * keep (the newest) and which to remove.
 */
import type { AirTariff, CircularRecord, DirectoryContact, SeaTariff } from "@/lib/types";

export type DuplicatePlan<T> = { keep: T; remove: T[] };

const norm = (s: string | undefined | null) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Groups items that share any key (a record can match on more than one rule). */
function cluster<T>(items: T[], keysOf: (item: T) => string[]): T[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const firstByKey = new Map<string, number>();
  items.forEach((item, i) => {
    for (const k of keysOf(item)) {
      const seen = firstByKey.get(k);
      if (seen == null) firstByKey.set(k, i);
      else parent[find(i)] = find(seen);
    }
  });
  const groups = new Map<number, T[]>();
  items.forEach((item, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), item]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

function plan<T>(groups: T[][], newer: (a: T, b: T) => number): Array<DuplicatePlan<T>> {
  return groups.map((g) => {
    const sorted = [...g].sort(newer);
    return { keep: sorted[0], remove: sorted.slice(1) };
  });
}

const byNewest = (get: (x: never) => string | undefined) => <T>(a: T, b: T) =>
  (get(b as never) || "").localeCompare(get(a as never) || "");

/**
 * Circulars are duplicates when everything that identifies them matches: same
 * category + carrier + validity dates, and either the same title or the same
 * file name. Different validity dates mean a different version, so those stay.
 */
export function planCircularDuplicates(list: CircularRecord[]): Array<DuplicatePlan<CircularRecord>> {
  const real = list.filter((c) => !c.id.startsWith("circ-local-"));
  const groups = cluster(real, (c) => {
    const base = [norm(c.category), norm(c.carrier), c.effectiveDate || "", c.expiryDate || c.validTo || ""].join("|");
    const keys: string[] = [];
    if (norm(c.title)) keys.push(`t|${base}|${norm(c.title)}`);
    if (norm(c.fileName)) keys.push(`f|${base}|${norm(c.fileName)}`);
    return keys;
  });
  return plan(groups, (a, b) => {
    const t = (b.createdAt || "").localeCompare(a.createdAt || "");
    if (t !== 0) return t;
    return Number(Boolean(b.downloadURL)) - Number(Boolean(a.downloadURL)); // prefer the one that actually has its file
  });
}

/** One tariff per lane and carrier (and cargo type for sea) — the newest wins, as lookups already assume. */
export function planTariffDuplicates<T extends AirTariff | SeaTariff>(list: T[]): Array<DuplicatePlan<T>> {
  const groups = cluster(list, (t) => [
    [t.origin, t.destination, (t.carrierCode || norm(t.carrier)).toUpperCase(), "mode" in t ? t.mode : ""].join("|"),
  ]);
  return plan(groups, byNewest((t: T) => t.createdAt));
}

/** Contacts are duplicates when name, type, email and location all match. */
export function planContactDuplicates(list: DirectoryContact[]): Array<DuplicatePlan<DirectoryContact>> {
  const groups = cluster(list, (c) => {
    if (!norm(c.name)) return [];
    return [[norm(c.category), norm(c.name), norm(c.email), norm(c.location)].join("|")];
  });
  // A copy that has an agreement file attached is never the one thrown away.
  const newest = byNewest((c: DirectoryContact) => c.updatedAt);
  return plan(groups, (a, b) => Number(Boolean(b.agreementUrl)) - Number(Boolean(a.agreementUrl)) || newest(a, b));
}

export function countRemovals<T>(plans: Array<DuplicatePlan<T>>): number {
  return plans.reduce((n, p) => n + p.remove.length, 0);
}
