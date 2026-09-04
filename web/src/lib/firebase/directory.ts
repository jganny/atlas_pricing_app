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
    agreementUrl: data.agreementUrl ? String(data.agreementUrl) : "",
    agreementFileName: data.agreementFileName ? String(data.agreementFileName) : "",
    suspended: Boolean(data.suspended),
    updatedBy: data.updatedBy ? String(data.updatedBy) : "",
    updatedAt: updatedAtStr,
  };
}

function sortByName(rows: DirectoryContact[]): DirectoryContact[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchDirectoryContacts(): Promise<DirectoryContact[]> {
  const db = getFirebaseDb();
  // No orderBy — avoids index / missing-field failures; sort client-side.
  const snap = await getDocs(collection(db, "contactsDirectory"));
  return sortByName(
    snap.docs.map((d) => mapContact(d.id, d.data() as Record<string, unknown>)),
  );
}

export function subscribeDirectoryContacts(
  onData: (rows: DirectoryContact[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, "contactsDirectory"),
    (snap) => {
      onData(
        sortByName(
          snap.docs.map((d) => mapContact(d.id, d.data() as Record<string, unknown>)),
        ),
      );
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
    agreementUrl: input.agreementUrl?.trim() || "",
    agreementFileName: input.agreementFileName?.trim() || "",
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
