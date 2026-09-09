"use client";

import { searchPincodes, type PincodeHit } from "@/lib/locations/pincode-search";
import { inferCountryFromText } from "@/lib/locations/country-aliases";

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

function hitScore(hit: PostalHit, q: string, inferred: string | null): number {
  const place = (hit.place || "").toLowerCase();
  const pin = (hit.pin || "").toLowerCase();
  const label = (hit.label || "").toLowerCase();
  let s = 10;
  if (place === q) s = 100;
  else if (place.startsWith(q)) s = 90;
  else if (pin === q || pin.startsWith(q)) s = 80;
  else if (label.startsWith(q)) s = 70;
  else if (label.includes(q)) s = 50;
  if (inferred && hit.country === inferred) s += 25;
  if (inferred && inferred !== "IN" && hit.country === "IN") s -= 40;
  return s;
}

/** Search India PINs first, then global samples. Rank exact city / inferred country above substring noise. */
export async function searchPostalCodes(query: string, limit = 14): Promise<PostalHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const inferred = inferCountryFromText(q);

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
      if (out.some((h) => h.label === row.l && h.country === (row.c || ""))) continue;
      out.push(toHit(row));
    }
  } catch {
    /* global sample optional */
  }

  return out
    .map((h) => ({ h, s: hitScore(h, q, inferred) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.h);
}
