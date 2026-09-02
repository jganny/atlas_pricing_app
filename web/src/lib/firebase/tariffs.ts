"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import type { AirTariff, SeaTariff } from "@/lib/types";
import { getFirebaseDb } from "./client";

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
    };
  });
}

export function lookupAirTariff(
  tariffs: AirTariff[],
  origin: string,
  destination: string,
  carrierCode?: string,
) {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  return (
    tariffs.find((t) => {
      if (t.origin !== o || t.destination !== d) return false;
      if (carrierCode && t.carrierCode !== carrierCode) return false;
      return true;
    }) ?? tariffs.find((t) => t.origin === o && t.destination === d)
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
  return (
    tariffs.find((t) => {
      if (t.origin !== o || t.destination !== d) return false;
      if (mode && t.mode !== mode) return false;
      return true;
    }) ?? tariffs.find((t) => t.origin === o && t.destination === d)
  );
}
