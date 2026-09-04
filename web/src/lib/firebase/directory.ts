"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { DirectoryContact } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapContact(id: string, data: Record<string, unknown>): DirectoryContact {
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined;
  let updatedAtStr = "";
  if (updatedAt && typeof updatedAt === "object" && typeof updatedAt.toDate === "function") {
    updatedAtStr = updatedAt.toDate().toISOString();
  } else if (typeof updatedAt === "string") {
    updatedAtStr = updatedAt;
  }

  return {
    id,
    name: String(data.name ?? ""),
    category: String(data.category ?? "agency"),
    contactPerson: data.contactPerson ? String(data.contactPerson) : "",
    email: data.email ? String(data.email) : "",
    phone: data.phone ? String(data.phone) : "",
    location: data.location ? String(data.location) : "",
    notes: data.notes ? String(data.notes) : "",
    sheetGroup: data.sheetGroup ? String(data.sheetGroup) : "",
    agreement: data.agreement ? String(data.agreement) : "",
    suspended: Boolean(data.suspended),
    updatedBy: data.updatedBy ? String(data.updatedBy) : "",
    updatedAt: updatedAtStr,
  };
}

export async function fetchDirectoryContacts(): Promise<DirectoryContact[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "contactsDirectory"), orderBy("name")));
  return snap.docs.map((d) => mapContact(d.id, d.data() as Record<string, unknown>));
}

export function subscribeDirectoryContacts(
  onData: (rows: DirectoryContact[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  const q = query(collection(db, "contactsDirectory"), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapContact(d.id, d.data() as Record<string, unknown>)));
    },
    (err) => onError?.(err),
  );
}

export type DirectoryContactInput = Omit<DirectoryContact, "id" | "updatedAt">;

export async function saveDirectoryContact(
  input: DirectoryContactInput & { id?: string },
  updatedBy: string,
): Promise<string> {
  const db = getFirebaseDb();
  const payload = {
    name: input.name.trim(),
    category: input.category || "agency",
    contactPerson: input.contactPerson?.trim() || "",
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    location: input.location?.trim() || "",
    notes: input.notes?.trim() || "",
    sheetGroup: input.sheetGroup?.trim() || "",
    agreement: input.agreement?.trim() || "",
    suspended: Boolean(input.suspended),
    updatedBy,
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, "contactsDirectory", input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, "contactsDirectory"), payload);
  return ref.id;
}

export async function deleteDirectoryContact(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "contactsDirectory", id));
}
