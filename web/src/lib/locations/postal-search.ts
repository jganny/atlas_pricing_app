"use client";

import { searchPincodes, type PincodeHit } from "@/lib/locations/pincode-search";

/** Unified India PIN + global postal / ZIP hit. */
export type PostalHit = PincodeHit & { country?: string };

type GlobalRaw = {
  p: string;
  l: string;
  place?: string;
  d?: string;
  s?: string;
  c?: string;
};

let globalCache: GlobalRaw[] | null = null;

async function loadGlobal(): Promise<GlobalRaw[]> {
  if (globalCache) return globalCache;
  const res = await fetch("/app/data/global-postals.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("global postals load failed");
  globalCache = (await res.json()) as GlobalRaw[];
  return globalCache;
}

function toHit(row: GlobalRaw): PostalHit {
  return {
    pin: row.p,
    label: row.l,
    place: row.place || "",
    district: row.d || "",
    state: row.s || "",
    country: row.c || "",
  };
}

/** Search India PINs first, then global samples. Free-text always allowed by the combobox. */
export async function searchPostalCodes(query: string, limit = 14): Promise<PostalHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: PostalHit[] = [];
  try {
    const india = await searchPincodes(q, Math.ceil(limit * 0.6));
    out.push(...india.map((h) => ({ ...h, country: "IN" as const })));
  } catch {
    /* India directory optional */
  }

  try {
    const global = await loadGlobal();
    for (const row of global) {
      const hay = `${row.p} ${row.l} ${row.place || ""} ${row.d || ""} ${row.s || ""} ${row.c || ""}`.toLowerCase();
      if (!hay.includes(q) && !row.p.toLowerCase().startsWith(q)) continue;
      if (out.some((h) => h.label === row.l)) continue;
      out.push(toHit(row));
      if (out.length >= limit) break;
    }
  } catch {
    /* global sample optional */
  }

  return out.slice(0, limit);
}
