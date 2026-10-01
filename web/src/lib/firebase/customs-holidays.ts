"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type { CustomsHoliday } from "@/lib/quotes/customs-holidays";
import { getFirebaseDb } from "./client";

function fromDoc(id: string, x: Record<string, unknown>): CustomsHoliday {
  return {
    id,
    branch: String(x.branch ?? ""),
    date: String(x.date ?? ""),
    name: String(x.name ?? ""),
    notes: x.notes ? String(x.notes) : undefined,
  };
}

export async function fetchCustomsHolidays(): Promise<CustomsHoliday[]> {
  const snap = await getDocs(collection(getFirebaseDb(), "customsHolidays"));
  return snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>));
}

export function subscribeCustomsHolidays(
  onData: (rows: CustomsHoliday[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), "customsHolidays"),
    (snap) => onData(snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  );
}

export async function upsertCustomsHoliday(
  row: Omit<CustomsHoliday, "id"> & { id?: string },
  updatedBy: string,
): Promise<string> {
  const id = row.id || `${row.branch}_${row.date}`.toLowerCase().replace(/[^a-z0-9_]/g, "-");
  await setDoc(doc(getFirebaseDb(), "customsHolidays", id), {
    branch: row.branch,
    date: row.date,
    name: row.name,
    notes: row.notes || "",
    updatedBy,
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function deleteCustomsHoliday(id: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "customsHolidays", id));
}

/** Bulk-import the owner's own branch holiday list — writes in batches of
 * 400 (Firestore's batch cap is 500) so a full year's calendar across every
 * branch imports in a couple of round-trips instead of one write per row. */
export async function importCustomsHolidays(
  rows: Array<Omit<CustomsHoliday, "id">>,
  updatedBy: string,
): Promise<number> {
  const db = getFirebaseDb();
  let written = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const slice = rows.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const row of slice) {
      const id = `${row.branch}_${row.date}`.toLowerCase().replace(/[^a-z0-9_]/g, "-");
      batch.set(doc(db, "customsHolidays", id), {
        branch: row.branch,
        date: row.date,
        name: row.name,
        notes: row.notes || "",
        updatedBy,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
  }
  return written;
}
