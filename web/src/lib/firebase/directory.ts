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
import { planAgencyImport } from "@/lib/quotes/agent-import";
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
    rating: Number.isFinite(Number(data.rating)) && data.rating !== "" && data.rating != null ? Number(data.rating) : undefined,
    creditTerms: data.creditTerms ? String(data.creditTerms) : undefined,
    moduleType: data.moduleType ? String(data.moduleType) : undefined,
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
 * What a weekly agent upload would do, worked out before anything is written — shown to the
 * user to confirm. See planAgencyImport for the rules.
 */
export async function previewAgencyImport(contacts: DirectoryContactInput[]) {
  const agencyRows = contacts.filter((c) => (c.category || "agency").toLowerCase() === "agency");
  return {
    plan: planAgencyImport(await fetchDirectoryContacts(), agencyRows),
    otherRows: contacts.length - agencyRows.length,
  };
}

/**
 * Writes a bulk Excel import as one dated batch.
 *
 * Overseas Agents (`replacePrevious`): the file replaces last week's imported agents, repeated
 * agents are kept once, and older copies of an agent the file covers are removed — see
 * planAgencyImport. Agents added by hand that aren't in the file are never touched.
 *
 * Any other contact list (`replacePrevious` false) only adds rows; nothing is removed.
 */
export async function importDirectoryContacts(
  contacts: DirectoryContactInput[],
  opts: { updatedBy: string; replacePrevious: boolean },
): Promise<{ added: number; replaced: number; absorbed: number; duplicatesRemoved: number }> {
  const db = getFirebaseDb();
  const batchId = `import-${Date.now()}`;

  type Write =
    | { kind: "delete"; id: string }
    | { kind: "set"; id?: string; data: Record<string, unknown> };

  const writes: Write[] = [];
  // Only Overseas Agents are replaced and de-duplicated weekly; any other contact rows in the file
  // (liners, airlines…) are simply added.
  const isAgency = (c: DirectoryContactInput) => (c.category || "agency").toLowerCase() === "agency";
  const others = opts.replacePrevious ? contacts.filter((c) => !isAgency(c)) : [];
  let incoming = opts.replacePrevious ? contacts.filter(isAgency) : contacts;
  let absorbed = 0;
  let replaced = 0;
  let duplicatesRemoved = 0;
  let existingById = new Map<string, DirectoryContact>();
  let absorbIdByIndex: Record<number, string> = {};

  if (opts.replacePrevious) {
    const existing = await fetchDirectoryContacts();
    existingById = new Map(existing.map((c) => [c.id, c]));
    const plan = planAgencyImport(existing, incoming);
    incoming = [...plan.incoming, ...others];
    absorbIdByIndex = plan.absorbIdByIndex; // indexes refer to the agency rows, which come first
    absorbed = Object.keys(absorbIdByIndex).length;
    replaced = plan.previousImportRemoved;
    duplicatesRemoved = plan.oldDuplicatesRemoved.length;
    plan.deleteIds.forEach((id) => writes.push({ kind: "delete", id }));
  }

  incoming.forEach((c, i) => {
    const absorbId = absorbIdByIndex[i];
    const old = absorbId ? existingById.get(absorbId) : undefined;
    writes.push({
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
        // An agreement already attached to the agent is kept when the file doesn't carry one.
        agreement: c.agreement?.trim() || old?.agreement || "",
        agreementUrl: c.agreementUrl?.trim() || old?.agreementUrl || "",
        agreementFileName: c.agreementFileName?.trim() || old?.agreementFileName || "",
        suspended: Boolean(c.suspended),
        ...(c.rating !== undefined ? { rating: c.rating } : {}),
        ...(c.creditTerms ? { creditTerms: c.creditTerms } : {}),
        ...(c.moduleType ? { moduleType: c.moduleType } : {}),
        importBatchId: batchId,
        updatedBy: opts.updatedBy,
        updatedAt: serverTimestamp(),
      },
    });
  });

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

  return { added: incoming.length - absorbed, replaced, absorbed, duplicatesRemoved };
}
