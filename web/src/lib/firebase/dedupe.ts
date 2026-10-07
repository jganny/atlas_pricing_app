"use client";

import { deleteDoc, doc } from "firebase/firestore";
import { deleteObject, getStorage, ref } from "firebase/storage";
import { getFirebaseApp, getFirebaseDb } from "./client";
import { fetchLiveCirculars } from "./circulars";
import { fetchDirectoryContacts } from "./directory";
import { fetchLiveAirTariffs, fetchLiveSeaTariffs } from "./tariffs";
import {
  countRemovals,
  type DuplicatePlan,
  planCircularDuplicates,
  planContactDuplicates,
  planTariffDuplicates,
} from "@/lib/quotes/dedupe";

export const DUPLICATES_REMOVED_EVENT = "atlas:duplicates-removed";

export type DuplicatesRemoved = { what: string; count: number };

function announce(what: string, count: number) {
  if (count <= 0 || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DuplicatesRemoved>(DUPLICATES_REMOVED_EVENT, { detail: { what, count } }));
}

/** Never lets a clean-up problem break the upload that triggered it. */
async function safely(what: string, run: () => Promise<number>): Promise<number> {
  try {
    const n = await run();
    announce(what, n);
    return n;
  } catch (e) {
    console.warn(`Duplicate clean-up (${what}):`, e instanceof Error ? e.message : e);
    return 0;
  }
}

/** After an upload: removes older copies of the same circular, keeping the newest. */
export function removeDuplicateCirculars(): Promise<number> {
  return safely("circulars", async () => {
    const plans = planCircularDuplicates(await fetchLiveCirculars());
    const db = getFirebaseDb();
    const storage = getStorage(getFirebaseApp());
    for (const p of plans) {
      for (const dup of p.remove) {
        await deleteDoc(doc(db, "circularsLibrary", dup.id));
        // The older file goes too — unless the kept copy points at the very same file.
        if (dup.storagePath && dup.storagePath !== p.keep.storagePath) {
          await deleteObject(ref(storage, dup.storagePath)).catch(() => undefined);
        }
      }
    }
    return countRemovals(plans);
  });
}

/** After a tariff upload: one tariff per lane and carrier — the newest. */
export function removeDuplicateTariffs(kind: "air" | "sea"): Promise<number> {
  return safely(kind === "air" ? "air tariffs" : "sea tariffs", async () => {
    const db = getFirebaseDb();
    const col = kind === "air" ? "air_tariffs" : "sea_tariffs";
    const plans: Array<DuplicatePlan<{ id: string }>> =
      kind === "air"
        ? planTariffDuplicates(await fetchLiveAirTariffs())
        : planTariffDuplicates(await fetchLiveSeaTariffs());
    for (const p of plans) for (const dup of p.remove) await deleteDoc(doc(db, col, dup.id));
    return countRemovals(plans);
  });
}

/** After a directory import: removes repeated contacts, keeping the newest (and any with an agreement file). */
export function removeDuplicateContacts(): Promise<number> {
  return safely("contacts", async () => {
    const plans = planContactDuplicates(await fetchDirectoryContacts());
    const db = getFirebaseDb();
    for (const p of plans) for (const dup of p.remove) await deleteDoc(doc(db, "contactsDirectory", dup.id));
    return countRemovals(plans);
  });
}
