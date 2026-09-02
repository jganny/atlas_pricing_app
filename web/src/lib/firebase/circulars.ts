"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { CircularRecord } from "@/lib/types";
import { getFirebaseDb } from "./client";

export async function fetchLiveCirculars(): Promise<CircularRecord[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, "circularsLibrary"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      title: data.title as string | undefined,
      carrier: data.carrier as string | undefined,
      category: data.category as string | undefined,
      notes: data.notes as string | undefined,
      createdAt: data.createdAt as string | undefined,
      validTo: data.validTo as string | undefined,
      fileName: data.fileName as string | undefined,
    };
  });
}
