"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { SalesTerritory } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapSalesTerritory(id: string, data: Record<string, unknown>): SalesTerritory {
  const ts = data.updatedAt as { toDate?: () => Date } | string | undefined;
  let updatedAt = "";
  if (ts && typeof ts === "object" && typeof ts.toDate === "function") {
    updatedAt = ts.toDate().toISOString();
  } else if (typeof ts === "string") updatedAt = ts;
  return {
    id,
    name: String(data.name ?? ""),
    description: data.description ? String(data.description) : undefined,
    ownerUsernames: Array.isArray(data.ownerUsernames) ? data.ownerUsernames.map((o) => String(o)) : undefined,
    updatedAt,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : updatedAt,
  };
}

export async function fetchSalesTerritories(): Promise<SalesTerritory[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "salesTerritories"));
  return snap.docs.map((d) => mapSalesTerritory(d.id, d.data() as Record<string, unknown>));
}

export function subscribeSalesTerritories(
  onData: (rows: SalesTerritory[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, "salesTerritories"),
    (snap) => onData(snap.docs.map((d) => mapSalesTerritory(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  );
}

export async function saveSalesTerritory(
  input: Omit<SalesTerritory, "id" | "updatedAt" | "createdAt"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || "",
    ownerUsernames: input.ownerUsernames ?? [],
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, "salesTerritories", input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, "salesTerritories"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSalesTerritory(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "salesTerritories", id));
}
