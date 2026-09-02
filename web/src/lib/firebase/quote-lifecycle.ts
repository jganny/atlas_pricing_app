"use client";

import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { SavedQuote } from "@/lib/types";
import { getFirebaseDb } from "./client";

export async function fetchQuoteById(id: string): Promise<SavedQuote | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "quotes", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SavedQuote, "id">) };
}

export async function saveQuoteDocument(quote: SavedQuote): Promise<string> {
  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", quote.id), quote, { merge: false });
  return quote.id;
}

export async function patchQuote(id: string, patch: Partial<SavedQuote>): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "quotes", id), patch as Record<string, unknown>);
}

export async function deleteQuoteById(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "quotes", id));
}

export async function setQuoteStatus(
  id: string,
  status: "quoted" | "converted" | "lost" | "cancelled",
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await patchQuote(id, { status, date: today });
}

export interface WonConversionInput {
  shipperName?: string
  shipperPhone?: string
  shipperEmail?: string
  shipperAddress?: string
  consigneeName?: string
  consigneePhone?: string
  consigneeEmail?: string
  consigneeAddress?: string
  commodity?: string
}

export async function convertQuoteToWon(id: string, input: WonConversionInput = {}): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await patchQuote(id, {
    status: "converted",
    conversionDate: today,
    date: today,
    ...input,
  });
}
