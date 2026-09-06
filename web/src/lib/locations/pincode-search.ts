"use client";

/** India PIN search — lazy-loads legacy pincodes.json (same source as v4). */

export type PincodeHit = {
  pin: string;
  label: string;
  place: string;
  district: string;
  state: string;
};

type Raw = { p: string; l: string; place?: string; d?: string; s?: string; all?: string };

let cache: Raw[] | null = null;

async function load(): Promise<Raw[]> {
  if (cache) return cache;
  const res = await fetch("/app/data/pincodes.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("pincodes load failed");
  cache = (await res.json()) as Raw[];
  return cache;
}

export async function searchPincodes(query: string, limit = 12): Promise<PincodeHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await load();
  const out: PincodeHit[] = [];
  for (const row of rows) {
    const hay = (row.all || `${row.p} ${row.l}`).toLowerCase();
    if (!hay.includes(q) && !row.p.startsWith(q)) continue;
    out.push({
      pin: row.p,
      label: row.l,
      place: row.place || "",
      district: row.d || "",
      state: row.s || "",
    });
    if (out.length >= limit) break;
  }
  return out;
}
