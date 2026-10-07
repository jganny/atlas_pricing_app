"use client";

import { arrayUnion, collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import type { NrsPartyFields, NrsRegistryEntry, NrsRegistryFollowUp } from "@/lib/quotes/nrs-registry";
import { partyUpdates } from "@/lib/quotes/nrs-registry";
import { getFirebaseDb } from "./client";

const COLLECTION = "nrs_registry";

/** Firestore rejects `undefined` fields, so drop them before saving. */
function clean<T extends object>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

export function subscribeNrsRegistry(
  onData: (rows: NrsRegistryEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), COLLECTION),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as NrsRegistryEntry), id: d.id }))),
    (err) => onError?.(err),
  );
}

/** Written when a nomination desk wins a quote. Merge keeps anything the desk already filled in. */
export async function saveNrsRegistryEntry(entry: NrsRegistryEntry): Promise<void> {
  await setDoc(doc(getFirebaseDb(), COLLECTION, entry.id), clean(entry), { merge: true });
}

export async function updateNrsRegistryParties(id: string, fields: NrsPartyFields): Promise<void> {
  await setDoc(doc(getFirebaseDb(), COLLECTION, id), clean(partyUpdates(fields)), { merge: true });
}

export async function addNrsRegistryFollowUp(id: string, entry: NrsRegistryFollowUp): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), COLLECTION, id), { followUps: arrayUnion(clean(entry)) });
}
