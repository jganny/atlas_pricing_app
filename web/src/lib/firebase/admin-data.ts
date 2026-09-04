"use client";

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { CreditControl } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapCredit(id: string, data: Record<string, unknown>): CreditControl {
  return {
    id,
    customer: String(data.customer ?? id),
    creditDays: Number(data.creditDays ?? 30) || 30,
    creditLimit: Number(data.creditLimit ?? 0) || 0,
    hasAgreement: Boolean(data.hasAgreement),
    waiveAgreement: Boolean(data.waiveAgreement),
    blocked: Boolean(data.blocked),
    notes: data.notes ? String(data.notes) : "",
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : (data.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() || "",
  };
}

export async function fetchCreditControls(): Promise<CreditControl[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "customer_control"));
  return snap.docs
    .map((d) => mapCredit(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.customer.localeCompare(b.customer));
}

export async function saveCreditControl(
  input: Omit<CreditControl, "updatedAt" | "id"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  const id =
    input.id ||
    input.customer
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") ||
    `cust_${Date.now()}`;
  await setDoc(
    doc(db, "customer_control", id),
    {
      customer: input.customer.trim(),
      creditDays: input.creditDays,
      creditLimit: input.creditLimit,
      hasAgreement: Boolean(input.hasAgreement),
      waiveAgreement: Boolean(input.waiveAgreement),
      blocked: Boolean(input.blocked),
      notes: input.notes?.trim() || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return id;
}

export async function fetchAgencyListRecipients(): Promise<string[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "app_settings"));
  const docSnap = snap.docs.find((d) => d.id === "agencyListRecipients");
  if (!docSnap) return [];
  const data = docSnap.data();
  const emails = data.emails || data.recipients || [];
  return Array.isArray(emails) ? emails.map(String) : [];
}

export async function saveAgencyListRecipients(emails: string[]): Promise<void> {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, "app_settings", "agencyListRecipients"),
    {
      emails: emails.map((e) => e.trim()).filter(Boolean),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
