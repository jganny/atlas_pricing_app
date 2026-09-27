"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import type { AirTariff, SeaTariff } from "@/lib/types";
import { getFirebaseDb } from "./client";

function timestampToIso(v: unknown): string {
  if (v && typeof v === "object" && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof v === "string" ? v : "";
}

export async function fetchLiveAirTariffs(): Promise<AirTariff[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, "air_tariffs"), where("published", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      carrier: String(data.carrier ?? ""),
      carrierCode: String(data.carrierCode ?? ""),
      origin: String(data.origin ?? "").toUpperCase(),
      destination: String(data.destination ?? "").toUpperCase(),
      breaks: (data.breaks as AirTariff["breaks"]) ?? {},
      currency: String(data.currency ?? "USD"),
      createdAt: timestampToIso(data.createdAt),
    };
  });
}

export async function fetchLiveSeaTariffs(): Promise<SeaTariff[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, "sea_tariffs"), where("published", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      carrier: String(data.carrier ?? ""),
      carrierCode: String(data.carrierCode ?? ""),
      origin: String(data.origin ?? "").toUpperCase(),
      destination: String(data.destination ?? "").toUpperCase(),
      mode: (data.mode as SeaTariff["mode"]) ?? "fcl",
      lclRate: (data.lclRate as SeaTariff["lclRate"]) ?? { sell: 0, buy: 0 },
      fclRates: (data.fclRates as SeaTariff["fclRates"]) ?? {},
      currency: String(data.currency ?? "USD"),
      createdAt: timestampToIso(data.createdAt),
    };
  });
}

/**
 * More than one tariff can exist for the same lane/carrier (e.g. a
 * corrected circular republished after the original) — nothing enforces
 * "only one" at write time, so lookup keeps only the newest per lane before
 * matching, the same "latest wins" rule the courier tariff lookup already
 * applies to its own tariff books.
 */
function dedupeByLaneCarrier<T extends { origin: string; destination: string; carrierCode: string; createdAt?: string }>(
  tariffs: T[],
): T[] {
  const best = new Map<string, T>();
  for (const t of tariffs) {
    const key = `${t.origin}::${t.destination}::${(t.carrierCode || "").toUpperCase()}`;
    const prev = best.get(key);
    if (!prev || (t.createdAt || "") > (prev.createdAt || "")) best.set(key, t);
  }
  return [...best.values()];
}

export function lookupAirTariff(
  tariffs: AirTariff[],
  origin: string,
  destination: string,
  carrierCode?: string,
) {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const deduped = dedupeByLaneCarrier(tariffs);
  return (
    deduped.find((t) => {
      if (t.origin !== o || t.destination !== d) return false;
      if (carrierCode && t.carrierCode !== carrierCode) return false;
      return true;
    }) ?? deduped.find((t) => t.origin === o && t.destination === d)
  );
}

export function lookupSeaTariff(
  tariffs: SeaTariff[],
  origin: string,
  destination: string,
  mode?: string,
) {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const deduped = dedupeByLaneCarrier(tariffs);
  return (
    deduped.find((t) => {
      if (t.origin !== o || t.destination !== d) return false;
      if (mode && t.mode !== mode) return false;
      return true;
    }) ?? deduped.find((t) => t.origin === o && t.destination === d)
  );
}
