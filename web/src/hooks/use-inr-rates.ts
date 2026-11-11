"use client";

import { useQuery } from "@tanstack/react-query";
import { inrPerUnitFrom } from "@/lib/quotes/fx";
import { setLiveInrRates } from "@/lib/quotes/money";

const KEY = "atlas_fx_inr_v1";

function cached(): Record<string, number> | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null") as { at: number; rates: Record<string, number> } | null;
    return raw && Date.now() - raw.at < 24 * 3_600_000 ? raw.rates : undefined;
  } catch {
    return undefined;
  }
}

async function fetchRates(): Promise<Record<string, number>> {
  const endpoints = ["https://open.er-api.com/v6/latest/INR"];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rates = inrPerUnitFrom(data.rates);
      if (Object.keys(rates).length > 20) {
        try {
          window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rates }));
        } catch {
          /* not saved */
        }
        setLiveInrRates(rates);
        return rates;
      }
    } catch {
      /* try next, or use what was saved */
    }
  }
  const old = cached();
  if (old) {
    setLiveInrRates(old);
    return old;
  }
  throw new Error("no rates");
}

/** Rupees per unit of each currency: live from the rate service, refreshed every 30 minutes, remembered for a day if the service cannot be reached. */
export function useInrRates(): Record<string, number> | null {
  const q = useQuery({ queryKey: ["fxInrRates"], queryFn: fetchRates, staleTime: 30 * 60_000, retry: 0, refetchOnWindowFocus: false });
  return q.data ?? null;
}
