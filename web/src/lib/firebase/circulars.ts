"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import type { CircularRecord } from "@/lib/types";
import { getFirebaseApp, getFirebaseDb } from "./client";

export const CIRCULAR_CATEGORIES = [
  { id: "courier_tariff", label: "Courier Tariff" },
  { id: "airline_tariff", label: "Airline Tariff" },
  { id: "fuel_circular_airline", label: "Fuel (Airline)" },
  { id: "line_circular", label: "Line Circular" },
  { id: "sea_tariff", label: "Sea Tariff" },
  { id: "general", label: "General" },
] as const;

function mapCircular(id: string, data: Record<string, unknown>): CircularRecord {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined;
  let createdAtStr = "";
  if (createdAt && typeof createdAt === "object" && typeof createdAt.toDate === "function") {
    createdAtStr = createdAt.toDate().toISOString();
  } else if (typeof createdAt === "string") {
    createdAtStr = createdAt;
  }
  return {
    id,
    title: data.title ? String(data.title) : "",
    carrier: data.carrier ? String(data.carrier) : "",
    category: data.category ? String(data.category) : "general",
    notes: data.notes ? String(data.notes) : "",
    createdAt: createdAtStr,
    validTo: data.validTo ? String(data.validTo) : data.expiryDate ? String(data.expiryDate) : "",
    fileName: data.fileName ? String(data.fileName) : "",
    downloadURL: data.downloadURL ? String(data.downloadURL) : "",
    storagePath: data.storagePath ? String(data.storagePath) : "",
    effectiveDate: data.effectiveDate ? String(data.effectiveDate) : "",
    expiryDate: data.expiryDate ? String(data.expiryDate) : "",
    uploadedBy: data.uploadedBy ? String(data.uploadedBy) : "",
  };
}

export async function fetchLiveCirculars(): Promise<CircularRecord[]> {
  const db = getFirebaseDb();
  try {
    const q = query(collection(db, "circularsLibrary"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapCircular(d.id, d.data() as Record<string, unknown>));
  } catch {
    const snap = await getDocs(collection(db, "circularsLibrary"));
    return snap.docs
      .map((d) => mapCircular(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
}

export type CircularInput = {
  id?: string;
  title: string;
  carrier?: string;
  category: string;
  notes?: string;
  effectiveDate?: string;
  expiryDate?: string;
  fileName?: string;
  downloadURL?: string;
  storagePath?: string;
};

export async function uploadCircularFile(
  file: File,
  category: string,
): Promise<{ downloadURL: string; storagePath: string; fileName: string }> {
  const storage = getStorage(getFirebaseApp());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `circulars/${category || "general"}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return { downloadURL, storagePath, fileName: file.name };
}

export async function saveCircular(
  input: CircularInput,
  uploadedBy: string,
): Promise<string> {
  const db = getFirebaseDb();
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    carrier: input.carrier?.trim() || "",
    category: input.category || "general",
    notes: input.notes?.trim() || "",
    effectiveDate: input.effectiveDate || "",
    expiryDate: input.expiryDate || "",
    validTo: input.expiryDate || "",
    uploadedBy,
    updatedAt: serverTimestamp(),
  };
  if (input.fileName) payload.fileName = input.fileName;
  if (input.downloadURL) payload.downloadURL = input.downloadURL;
  if (input.storagePath) payload.storagePath = input.storagePath;

  if (input.id) {
    await updateDoc(doc(db, "circularsLibrary", input.id), payload);
    return input.id;
  }
  payload.createdAt = serverTimestamp();
  const refDoc = await addDoc(collection(db, "circularsLibrary"), payload);
  return refDoc.id;
}

export async function deleteCircular(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "circularsLibrary", id));
}

/** Parse a simple Excel/CSV-ish tariff sheet into preview rows (client-side). */
export function parseTariffImportRows(
  rows: Array<Record<string, unknown>>,
): Array<{ origin: string; destination: string; carrier: string; sell: number; buy: number }> {
  return rows
    .map((r) => {
      const keys = Object.keys(r);
      const get = (...names: string[]) => {
        for (const n of names) {
          const k = keys.find((x) => x.toLowerCase().replace(/\s/g, "") === n.toLowerCase());
          if (k != null && r[k] != null && String(r[k]).trim() !== "") return String(r[k]).trim();
        }
        return "";
      };
      const sell = Number(get("sell", "sellrate", "rate", "min"));
      const buy = Number(get("buy", "buyrate", "cost") || sell * 0.85);
      return {
        origin: get("origin", "pol", "from").toUpperCase(),
        destination: get("destination", "pod", "to").toUpperCase(),
        carrier: get("carrier", "airline", "liner") || "Imported",
        sell: Number.isFinite(sell) ? sell : 0,
        buy: Number.isFinite(buy) ? buy : 0,
      };
    })
    .filter((r) => r.origin && r.destination);
}

export async function publishAirTariffRows(
  rows: Array<{ origin: string; destination: string; carrier: string; sell: number; buy: number }>,
  uploadedBy: string,
): Promise<number> {
  const db = getFirebaseDb();
  let n = 0;
  for (const row of rows) {
    const carrierCode = row.carrier.slice(0, 2).toUpperCase();
    // One row per lane+carrier, not one per import — replace whichever
    // tariff already covers this exact lane/carrier instead of adding a
    // second one the app then has no rule for choosing between.
    const existing = await getDocs(
      query(
        collection(db, "air_tariffs"),
        where("origin", "==", row.origin),
        where("destination", "==", row.destination),
        where("carrierCode", "==", carrierCode),
      ),
    );
    const payload = {
      carrier: row.carrier,
      carrierCode,
      origin: row.origin,
      destination: row.destination,
      currency: "USD",
      // The uploaded sheet only carries one sell/buy pair, not the airline's
      // real per-break rates, so the higher brackets are estimated at a
      // declining discount off it — real bracket-name keys this time
      // (AIR_WEIGHT_BREAKS in lib/pricing/air-desk.ts), not the old
      // "45"/"100"/"300" strings nothing in the app actually reads.
      breaks: {
        min: { sell: row.sell, buy: row.buy },
        minus45: { sell: row.sell, buy: row.buy },
        plus45: { sell: row.sell * 0.95, buy: row.buy * 0.95 },
        plus100: { sell: row.sell * 0.9, buy: row.buy * 0.9 },
        plus300: { sell: row.sell * 0.85, buy: row.buy * 0.85 },
        plus500: { sell: row.sell * 0.8, buy: row.buy * 0.8 },
        plus1000: { sell: row.sell * 0.75, buy: row.buy * 0.75 },
      },
      uploadedBy,
      published: true,
      createdAt: serverTimestamp(),
    };
    if (!existing.empty) {
      await updateDoc(doc(db, "air_tariffs", existing.docs[0].id), payload);
    } else {
      await addDoc(collection(db, "air_tariffs"), payload);
    }
    n += 1;
  }
  return n;
}

/**
 * Publishes a single lane/carrier's REAL per-weight-break rates — as read
 * from the airline's own circular by AI extraction, reviewed and confirmed
 * by the desk — rather than publishAirTariffRows' single-sell/buy-pair
 * estimate. Same replace-matching-lane/carrier rule as publishAirTariffRows.
 */
export async function publishAirTariffBreaks(
  row: {
    origin: string;
    destination: string;
    carrier: string;
    carrierCode?: string;
    currency: string;
    breaks: Record<string, { sell: number | null; buy: number | null }>;
  },
  uploadedBy: string,
): Promise<void> {
  const db = getFirebaseDb();
  const origin = row.origin.trim().toUpperCase();
  const destination = row.destination.trim().toUpperCase();
  const carrierCode = (row.carrierCode || row.carrier.slice(0, 2)).trim().toUpperCase();

  const existing = await getDocs(
    query(
      collection(db, "air_tariffs"),
      where("origin", "==", origin),
      where("destination", "==", destination),
      where("carrierCode", "==", carrierCode),
    ),
  );

  const breaks: Record<string, { sell: number; buy: number }> = {};
  for (const [key, value] of Object.entries(row.breaks)) {
    breaks[key] = { sell: value.sell ?? 0, buy: value.buy ?? 0 };
  }

  const payload = {
    carrier: row.carrier,
    carrierCode,
    origin,
    destination,
    currency: row.currency,
    breaks,
    source: "ai_extraction",
    uploadedBy,
    published: true,
    createdAt: serverTimestamp(),
  };

  if (!existing.empty) {
    await updateDoc(doc(db, "air_tariffs", existing.docs[0].id), payload);
  } else {
    await addDoc(collection(db, "air_tariffs"), payload);
  }
}
