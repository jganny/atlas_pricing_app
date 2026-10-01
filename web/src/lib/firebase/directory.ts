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
  writeBatch,
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
    importBatchId: data.importBatchId ? String(data.importBatchId) : undefined,
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

/**
 * Writes a bulk Excel import as one dated batch. When `replacePrevious` is
 * true:
 *  - every existing "agency" contact that itself came from an earlier
 *    import (has an `importBatchId`) is deleted first — so this week's
 *    file replaces last week's imported rows instead of piling on top of
 *    them.
 *  - a contact added BY HAND (no `importBatchId`) is left alone UNLESS
 *    this week's file contains a row with the exact same name, in which
 *    case the uploaded row's data takes over that same document — the
 *    manual entry is "absorbed" into the tracked batch instead of leaving
 *    two records for the same agent, and from then on it's a normal
 *    import-managed row (replaceable by a future upload the same way).
 *    A hand-added contact with no name match in the new file is untouched.
 */
export async function importDirectoryContacts(
  contacts: DirectoryContactInput[],
  opts: { updatedBy: string; replacePrevious: boolean },
): Promise<{ added: number; replaced: number; absorbed: number }> {
  const db = getFirebaseDb();
  const batchId = `import-${Date.now()}`;

  let toDelete: string[] = [];
  const manualIdByName = new Map<string, string>();
  if (opts.replacePrevious) {
    const existing = await fetchDirectoryContacts();
    const isAgency = (c: DirectoryContact) => (c.category || "").toLowerCase() === "agency";
    toDelete = existing.filter((c) => isAgency(c) && c.importBatchId).map((c) => c.id);
    for (const c of existing) {
      if (isAgency(c) && !c.importBatchId) {
        manualIdByName.set(c.name.trim().toLowerCase(), c.id);
      }
    }
  }

  type Write =
    | { kind: "delete"; id: string }
    | { kind: "set"; id?: string; data: Record<string, unknown> };

  let absorbed = 0;
  const writes: Write[] = [
    ...toDelete.map((id): Write => ({ kind: "delete", id })),
    ...contacts.map((c): Write => {
      const absorbId = manualIdByName.get(c.name.trim().toLowerCase());
      if (absorbId) absorbed += 1;
      return {
        kind: "set",
        id: absorbId,
        data: {
          name: c.name.trim(),
          category: c.category || "agency",
          contactPerson: c.contactPerson?.trim() || "",
          email: c.email?.trim() || "",
          phone: c.phone?.trim() || "",
          location: c.location?.trim() || "",
          notes: c.notes?.trim() || "",
          sheetGroup: c.sheetGroup?.trim() || "",
          agreement: c.agreement?.trim() || "",
          agreementUrl: c.agreementUrl?.trim() || "",
          agreementFileName: c.agreementFileName?.trim() || "",
          suspended: Boolean(c.suspended),
          importBatchId: batchId,
          updatedBy: opts.updatedBy,
          updatedAt: serverTimestamp(),
        },
      };
    }),
  ];

  // Firestore batched writes cap at 500 ops — chunk with headroom to spare.
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const slice = writes.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    for (const w of slice) {
      if (w.kind === "delete") batch.delete(doc(db, "contactsDirectory", w.id));
      else batch.set(w.id ? doc(db, "contactsDirectory", w.id) : doc(collection(db, "contactsDirectory")), w.data);
    }
    await batch.commit();
  }

  return { added: contacts.length - absorbed, replaced: toDelete.length, absorbed };
}
