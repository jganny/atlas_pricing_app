"use client";

import { arrayUnion, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  applyRemoteCustomEntries,
  isCustomEntryType,
  setCustomEntryWriter,
  type CustomEntry,
} from "@/lib/custom-entries";
import { getFirebaseDb } from "./client";

const COLLECTION = "custom_autocomplete_entries";

/**
 * Keeps the shared custom-entry lists in sync: anything the original app saved
 * (and anything anyone adds here) appears in every dropdown on every computer.
 * New names are added with arrayUnion, so two people adding at once never
 * overwrite each other.
 */
export function startCustomEntriesSync(): () => void {
  const db = getFirebaseDb();
  setCustomEntryWriter((type, entry: CustomEntry) => {
    void setDoc(doc(db, COLLECTION, type), { entries: arrayUnion(entry) }, { merge: true }).catch((e) =>
      console.warn("Custom entry save:", e instanceof Error ? e.message : e),
    );
  });
  const off = onSnapshot(
    collection(db, COLLECTION),
    (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data() as { entries?: unknown };
        if (isCustomEntryType(d.id) && Array.isArray(data.entries)) {
          applyRemoteCustomEntries(d.id, data.entries as CustomEntry[]);
        }
      });
    },
    (err) => console.warn("Custom entries sync:", err.message),
  );
  return () => {
    off();
    setCustomEntryWriter(null);
  };
}
