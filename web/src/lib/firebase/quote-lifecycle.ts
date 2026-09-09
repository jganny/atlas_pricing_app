"use client";

import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { SavedQuote } from "@/lib/types";
import { getFirebaseDb } from "./client";
import { omitUndefinedDeep } from "./sanitize";
import {
  clearDeletedQuoteId,
  forgetLocalEnquiry,
  getLocalQuote,
  listLocalEnquiries,
  listLocalQuotes,
  rememberLocalEnquiry,
  rememberLocalQuote,
} from "@/lib/quotes/local-enquiries";
import { hideQuoteFromAsk, unhideQuoteFromAsk } from "@/lib/quotes/hidden-ask";
import { removeOfflineQuote } from "@/lib/quotes/offline-cache";

export async function fetchQuoteById(id: string): Promise<SavedQuote | null> {
  const local = getLocalQuote(id);
  try {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, "quotes", id));
    if (snap.exists()) return { id: snap.id, ...(snap.data() as Omit<SavedQuote, "id">) };
  } catch {
    /* offline or unauthenticated — fall through to local */
  }
  return local;
}

export async function saveQuoteDocument(quote: SavedQuote): Promise<string> {
  const db = getFirebaseDb();
  await setDoc(doc(db, "quotes", quote.id), omitUndefinedDeep(quote), { merge: false });
  return quote.id;
}

export async function patchQuote(id: string, patch: Partial<SavedQuote>): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "quotes", id), omitUndefinedDeep(patch) as Record<string, unknown>);
}

export async function deleteQuoteById(id: string): Promise<void> {
  const localQuote = listLocalQuotes()[id] ?? null;
  const localRow = listLocalEnquiries().find((r) => r.id === id) ?? null;
  forgetLocalEnquiry(id);
  hideQuoteFromAsk(id);
  try {
    removeOfflineQuote(id);
  } catch {
    /* ignore */
  }
  try {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, "quotes", id));
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "not-found" || /not-found/i.test(msg)) return;
    clearDeletedQuoteId(id);
    unhideQuoteFromAsk(id);
    if (localRow) rememberLocalEnquiry(localRow);
    if (localQuote) rememberLocalQuote(localQuote);
    throw err;
  }
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
