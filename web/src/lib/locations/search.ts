"use client";

/** Client-side airport / seaport directory search (static JSON under /app/data). */

export type LocationHit = {
  code: string;
  name: string;
  city: string;
  country: string;
  kind: "airport" | "seaport";
};

type Raw = { code: string; name: string; city?: string; country?: string };

let airCache: Raw[] | null = null;
let seaCache: Raw[] | null = null;

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json() as Promise<T>;
}

/** basePath is /app — public files are served under that prefix. */
const DATA = {
  air: "/app/data/airports-slim.json",
  sea: "/app/data/seaports-slim.json",
  carriers: "/app/data/carriers-slim.json",
};

export async function ensureLocationIndexes() {
  if (!airCache) airCache = await loadJson<Raw[]>(DATA.air);
  if (!seaCache) seaCache = await loadJson<Raw[]>(DATA.sea);
}

function score(row: Raw, q: string): number {
  const code = (row.code || "").toUpperCase();
  const name = (row.name || "").toLowerCase();
  const city = (row.city || "").toLowerCase();
  const country = (row.country || "").toLowerCase();
  const ql = q.toLowerCase();
  if (code === q) return 100;
  if (code.startsWith(q)) return 90;
  if (code.includes(q)) return 70;
  if (name.startsWith(ql)) return 60;
  if (city.startsWith(ql)) return 55;
  if (name.includes(ql)) return 40;
  if (city.includes(ql)) return 35;
  if (country.includes(ql)) return 20;
  return 0;
}

export async function searchLocations(
  query: string,
  kind: "airport" | "seaport" | "all" = "all",
  limit = 8,
): Promise<LocationHit[]> {
  const q = query.trim().toUpperCase();
  if (q.length < 1) return [];
  await ensureLocationIndexes();
  const pools: Array<{ kind: "airport" | "seaport"; rows: Raw[] }> = [];
  if (kind !== "seaport") pools.push({ kind: "airport", rows: airCache || [] });
  if (kind !== "airport") pools.push({ kind: "seaport", rows: seaCache || [] });

  const hits: Array<LocationHit & { s: number }> = [];
  for (const pool of pools) {
    for (const row of pool.rows) {
      const s = score(row, q);
      if (s <= 0) continue;
      hits.push({
        code: row.code,
        name: row.name,
        city: row.city || "",
        country: row.country || "",
        kind: pool.kind,
        s,
      });
    }
  }
  return hits
    .sort((a, b) => b.s - a.s || a.code.localeCompare(b.code))
    .slice(0, limit)
    .map(({ s: _s, ...rest }) => rest);
}
