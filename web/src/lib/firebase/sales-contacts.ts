"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { SalesContact } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapSalesContact(id: string, data: Record<string, unknown>): SalesContact {
  const ts = data.updatedAt as { toDate?: () => Date } | string | undefined;
  let updatedAt = "";
  if (ts && typeof ts === "object" && typeof ts.toDate === "function") {
    updatedAt = ts.toDate().toISOString();
  } else if (typeof ts === "string") updatedAt = ts;
  return {
    id,
    accountId: String(data.accountId ?? ""),
    name: String(data.name ?? ""),
    title: data.title ? String(data.title) : undefined,
    email: data.email ? String(data.email) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    isPrimary: Boolean(data.isPrimary),
    owner: String(data.owner ?? ""),
    notes: data.notes ? String(data.notes) : undefined,
    updatedAt,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : updatedAt,
  };
}

export async function fetchSalesContacts(accountId: string): Promise<SalesContact[]> {
  const db = getFirebaseDb();
  try {
    const q = query(collection(db, "salesContacts"), where("accountId", "==", accountId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapSalesContact(d.id, d.data() as Record<string, unknown>));
  } catch {
    const snap = await getDocs(collection(db, "salesContacts"));
    return snap.docs
      .map((d) => mapSalesContact(d.id, d.data() as Record<string, unknown>))
      .filter((c) => c.accountId === accountId);
  }
}

export function subscribeSalesContacts(
  accountId: string,
  onData: (rows: SalesContact[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  const q = query(collection(db, "salesContacts"), where("accountId", "==", accountId));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapSalesContact(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  );
}

export async function saveSalesContact(
  input: Omit<SalesContact, "id" | "updatedAt" | "createdAt"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  const payload = {
    accountId: input.accountId,
    name: input.name.trim(),
    title: input.title?.trim() || "",
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    isPrimary: Boolean(input.isPrimary),
    owner: input.owner.trim(),
    notes: input.notes?.trim() || "",
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, "salesContacts", input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, "salesContacts"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSalesContact(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "salesContacts", id));
}
