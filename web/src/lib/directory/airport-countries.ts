"use client";

let cache: Map<string, string> | null = null;

/** Airport code → two-letter country, loaded once from the airport list the app already ships. */
export async function loadAirportCountries(): Promise<Map<string, string>> {
  if (cache) return cache;
  const base = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "" : "/app";
  try {
    const rows = (await (await fetch(`${base}/data/airports-slim.json`, { cache: "force-cache" })).json()) as Array<{ code: string; country?: string }>;
    cache = new Map(rows.filter((r) => r.country).map((r) => [r.code.toUpperCase(), String(r.country).toUpperCase()]));
  } catch {
    cache = new Map();
  }
  return cache;
}
