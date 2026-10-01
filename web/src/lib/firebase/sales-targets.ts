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
import type { SalesTarget } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapSalesTarget(id: string, data: Record<string, unknown>): SalesTarget {
  const ts = data.updatedAt as { toDate?: () => Date } | string | undefined;
  let updatedAt = "";
  if (ts && typeof ts === "object" && typeof ts.toDate === "function") {
    updatedAt = ts.toDate().toISOString();
  } else if (typeof ts === "string") updatedAt = ts;
  return {
    id,
    owner: String(data.owner ?? ""),
    period: String(data.period ?? ""),
    targetRevenue: Number(data.targetRevenue ?? 0),
    targetWinCount: typeof data.targetWinCount === "number" ? data.targetWinCount : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    updatedAt,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : updatedAt,
  };
}

export async function fetchSalesTargets(): Promise<SalesTarget[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "salesTargets"));
  return snap.docs.map((d) => mapSalesTarget(d.id, d.data() as Record<string, unknown>));
}

export function subscribeSalesTargets(
  onData: (rows: SalesTarget[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, "salesTargets"),
    (snap) => onData(snap.docs.map((d) => mapSalesTarget(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  );
}

export async function saveSalesTarget(
  input: Omit<SalesTarget, "id" | "updatedAt" | "createdAt"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  const payload = {
    owner: input.owner.trim(),
    period: input.period.trim(),
    targetRevenue: input.targetRevenue ?? 0,
    targetWinCount: input.targetWinCount ?? 0,
    notes: input.notes?.trim() || "",
    createdBy: input.createdBy || "",
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, "salesTargets", input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, "salesTargets"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSalesTarget(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "salesTargets", id));
}
