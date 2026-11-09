let cache: Record<string, string> | null = null;

/** Airline code -> name, from the airline list the app already ships (public/data/carriers-slim.json). */
export async function loadAirlineNames(): Promise<Record<string, string>> {
  if (cache) return cache;
  const base = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "" : "/app";
  const out: Record<string, string> = {};
  try {
    const json = (await (await fetch(`${base}/data/carriers-slim.json`, { cache: "force-cache" })).json()) as { air: Array<{ code: string; name: string }> };
    for (const a of json.air) if (/^[A-Z0-9]{2}$/.test(a.code)) out[a.code] = a.name.replace(/\s+Limited$/i, "");
    cache = out;
  } catch {
    /* the codes themselves are shown instead */
  }
  return out;
}
