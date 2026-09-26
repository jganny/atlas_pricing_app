"use client";

import { collection, deleteDoc, doc, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { ClientErrorRecord } from "@/lib/monitoring/error-groups";
import { getFirebaseDb } from "./client";

export async function fetchClientErrors(max = 400): Promise<ClientErrorRecord[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), "clientErrors"), orderBy("atIso", "desc"), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    const s = (k: string) => String(x[k] ?? "");
    return {
      id: d.id,
      atIso: s("atIso"),
      actor: s("actor"),
      fingerprint: s("fingerprint"),
      message: s("message"),
      stack: s("stack"),
      componentStack: s("componentStack"),
      source: s("source"),
      path: s("path"),
      version: s("version"),
      userAgent: s("userAgent"),
    };
  });
}

/** Admin "resolve": removes every stored occurrence of one problem. */
export async function deleteClientErrors(ids: string[]): Promise<void> {
  const db = getFirebaseDb();
  await Promise.all(ids.map((id) => deleteDoc(doc(db, "clientErrors", id))));
}
