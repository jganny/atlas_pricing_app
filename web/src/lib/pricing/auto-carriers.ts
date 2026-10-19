/**
 * Auto-draft for the Air and Sea desks: every carrier that has a Circulars rate on the quote's lane is added
 * and priced automatically, so the user starts from a finished comparison and removes what they don't want.
 * Only carriers with a real tariff on file are added — nothing is guessed.
 */
import { EMPTY_AIR_BREAKS } from "@/lib/pricing/air-desk";
import { createAirlineOption, createLinerOption, type AirlineOption, type LinerOption } from "@/lib/pricing/carrier-options";
import { normalizeCarrierName } from "@/lib/quotes/historical-autofill";
import type { SeaContainerRow } from "@/lib/pricing/sea-desk";
import type { AirTariff, SeaTariff } from "@/lib/types";

export const MAX_AUTO_CARRIERS = 6;

export interface AutoCarriers<T> {
  options: T[];
  /** The currency of the added rates (the desk quotes in one currency). */
  currency?: string;
  /** Carriers on the lane left out because their rates are in a different currency. */
  skipped: string[];
}

/** Newest tariff per carrier on this lane. */
function latestPerCarrier<T extends { carrier: string; origin: string; destination: string; createdAt?: string }>(
  tariffs: T[],
  origin: string,
  destination: string,
): T[] {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const best = new Map<string, T>();
  for (const t of tariffs) {
    if (t.origin !== o || t.destination !== d) continue;
    const key = normalizeCarrierName(t.carrier);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || (t.createdAt || "") > (prev.createdAt || "")) best.set(key, t);
  }
  return [...best.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.carrier.localeCompare(b.carrier));
}

function sameCurrency<T extends { currency: string; carrier: string }>(rows: T[]): { keep: T[]; skipped: string[]; currency?: string } {
  if (!rows.length) return { keep: [], skipped: [] };
  const currency = rows[0].currency;
  const keep = rows.filter((r) => r.currency === currency);
  return { keep, skipped: rows.filter((r) => r.currency !== currency).map((r) => r.carrier), currency };
}

const hasAirRate = (t: AirTariff) => Object.values(t.breaks || {}).some((b) => (b?.sell ?? 0) > 0 || (b?.buy ?? 0) > 0);
const hasSeaRate = (t: SeaTariff) =>
  (t.lclRate?.sell ?? 0) > 0 || (t.lclRate?.buy ?? 0) > 0 || Object.values(t.fclRates || {}).some((r) => (r?.sell ?? 0) > 0 || (r?.buy ?? 0) > 0);

export function autoAirlines(
  tariffs: AirTariff[],
  originCode: string,
  destCode: string,
  opts: { laneId?: string; alreadyNamed?: string[] } = {},
): AutoCarriers<AirlineOption> {
  if (!originCode || !destCode) return { options: [], skipped: [] };
  const have = new Set((opts.alreadyNamed ?? []).map(normalizeCarrierName));
  const rows = latestPerCarrier(tariffs, originCode, destCode).filter((t) => hasAirRate(t) && !have.has(normalizeCarrierName(t.carrier)));
  const { keep, skipped, currency } = sameCurrency(rows);
  const options = keep.slice(0, MAX_AUTO_CARRIERS).map((t, i) =>
    createAirlineOption({ name: t.carrier, laneId: opts.laneId ?? "", breaks: { ...EMPTY_AIR_BREAKS, ...t.breaks } }, i === 0 && have.size === 0),
  );
  return { options, currency, skipped };
}

export function autoLiners(
  tariffs: SeaTariff[],
  originCode: string,
  destCode: string,
  mode: string,
  opts: { laneId?: string; alreadyNamed?: string[]; containers?: SeaContainerRow[] } = {},
): AutoCarriers<LinerOption> {
  if (!originCode || !destCode) return { options: [], skipped: [] };
  const have = new Set((opts.alreadyNamed ?? []).map(normalizeCarrierName));
  const onMode = tariffs.filter((t) => !mode || t.mode === mode);
  const rows = latestPerCarrier(onMode, originCode, destCode).filter((t) => hasSeaRate(t) && !have.has(normalizeCarrierName(t.carrier)));
  const { keep, skipped, currency } = sameCurrency(rows);
  const options = keep.slice(0, MAX_AUTO_CARRIERS).map((t, i) =>
    createLinerOption(
      {
        name: t.carrier,
        laneId: opts.laneId ?? "",
        // Same containers as the shipment; the desk's own tariff fill then prices each one.
        ...(opts.containers?.length ? { containers: opts.containers.map((c) => ({ ...c, sellRate: 0, buyRate: 0 })) } : {}),
      },
      i === 0 && have.size === 0,
    ),
  );
  return { options, currency, skipped };
}
