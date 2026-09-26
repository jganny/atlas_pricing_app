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
import type { Account } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapAccount(id: string, data: Record<string, unknown>): Account {
  const ts = data.updatedAt as { toDate?: () => Date } | string | undefined;
  let updatedAt = "";
  if (ts && typeof ts === "object" && typeof ts.toDate === "function") {
    updatedAt = ts.toDate().toISOString();
  } else if (typeof ts === "string") updatedAt = ts;
  return {
    id,
    name: String(data.name ?? ""),
    industry: data.industry ? String(data.industry) : undefined,
    website: data.website ? String(data.website) : undefined,
    billingAddress: data.billingAddress ? String(data.billingAddress) : undefined,
    primaryContactId: data.primaryContactId ? String(data.primaryContactId) : undefined,
    owner: String(data.owner ?? ""),
    territory: data.territory ? String(data.territory) : undefined,
    accountType: (data.accountType as Account["accountType"]) || undefined,
    contractRenewalDate: data.contractRenewalDate ? String(data.contractRenewalDate) : undefined,
    lastWonAt: data.lastWonAt ? String(data.lastWonAt) : undefined,
    lastQuoteAt: data.lastQuoteAt ? String(data.lastQuoteAt) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    updatedAt,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : updatedAt,
  };
}

export async function fetchAccounts(): Promise<Account[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "accounts"));
  return snap.docs
    .map((d) => mapAccount(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function subscribeAccounts(
  onData: (rows: Account[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, "accounts"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => mapAccount(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
      );
    },
    (err) => onError?.(err),
  );
}

export async function saveAccount(
  input: Omit<Account, "id" | "updatedAt" | "createdAt"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  const payload = {
    name: input.name.trim(),
    industry: input.industry?.trim() || "",
    website: input.website?.trim() || "",
    billingAddress: input.billingAddress?.trim() || "",
    primaryContactId: input.primaryContactId || "",
    owner: input.owner.trim(),
    territory: input.territory || "",
    accountType: input.accountType || "prospect",
    contractRenewalDate: input.contractRenewalDate || "",
    lastWonAt: input.lastWonAt || "",
    lastQuoteAt: input.lastQuoteAt || "",
    notes: input.notes?.trim() || "",
    createdBy: input.createdBy || "",
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, "accounts", input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, "accounts"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteAccount(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "accounts", id));
}
