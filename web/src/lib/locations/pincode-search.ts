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

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function rowScore(row: Raw, q: string): number {
  const pin = (row.p || "").toLowerCase();
  const place = (row.place || "").toLowerCase();
  const label = (row.l || "").toLowerCase();
  const district = (row.d || "").toLowerCase();
  const state = (row.s || "").toLowerCase();
  if (pin === q) return 100;
  if (pin.startsWith(q)) return 90;
  if (place === q) return 85;
  if (place.startsWith(q)) return 75;
  if (label.includes(q)) return 60;
  if (district.startsWith(q) || state.startsWith(q)) return 40;
  if (tokens(row.all || `${row.p} ${row.l}`).some((t) => t === q || t.startsWith(q))) return 30;
  return 0;
}

export async function searchPincodes(query: string, limit = 12): Promise<PincodeHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await load();
  const scored: Array<{ hit: PincodeHit; s: number }> = [];
  for (const row of rows) {
    const s = rowScore(row, q);
    if (s <= 0) continue;
    scored.push({
      s,
      hit: {
        pin: row.p,
        label: row.l,
        place: row.place || "",
        district: row.d || "",
        state: row.s || "",
      },
    });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.hit);
}
