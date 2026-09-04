"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { LeadActivity, LeadStatus, SalesLead } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapLead(id: string, data: Record<string, unknown>): SalesLead {
  const ts = data.updatedAt as { toDate?: () => Date } | string | undefined;
  let updatedAt = "";
  if (ts && typeof ts === "object" && typeof ts.toDate === "function") {
    updatedAt = ts.toDate().toISOString();
  } else if (typeof ts === "string") updatedAt = ts;
  return {
    id,
    company: String(data.company ?? ""),
    contactName: data.contactName ? String(data.contactName) : "",
    email: data.email ? String(data.email) : "",
    phone: data.phone ? String(data.phone) : "",
    status: (String(data.status || "new") as LeadStatus) || "new",
    mode: data.mode as SalesLead["mode"],
    lane: data.lane ? String(data.lane) : "",
    dealValue:
      typeof data.dealValue === "number"
        ? data.dealValue
        : Number(data.dealValue ?? data.value ?? data.amount ?? data.expectedValue ?? 0) ||
          undefined,
    nextAction: data.nextAction ? String(data.nextAction) : "",
    nextDueDate: data.nextDueDate ? String(data.nextDueDate) : "",
    winLossReason: data.winLossReason ? String(data.winLossReason) : "",
    owner: data.owner ? String(data.owner) : "",
    notes: data.notes ? String(data.notes) : "",
    updatedAt,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : updatedAt,
  };
}

function mapActivity(id: string, data: Record<string, unknown>): LeadActivity {
  const ts = data.createdAt as { toDate?: () => Date } | string | undefined;
  let createdAt = new Date().toISOString();
  if (ts && typeof ts === "object" && typeof ts.toDate === "function") {
    createdAt = ts.toDate().toISOString();
  } else if (typeof ts === "string") createdAt = ts;
  return {
    id,
    leadId: String(data.leadId ?? ""),
    type: (String(data.type || "note") as LeadActivity["type"]) || "note",
    body: String(data.body ?? ""),
    createdBy: data.createdBy ? String(data.createdBy) : "",
    createdAt,
  };
}

export async function fetchLeads(): Promise<SalesLead[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "leads"));
  return snap.docs
    .map((d) => mapLead(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function subscribeLeads(
  onData: (rows: SalesLead[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, "leads"),
    (snap) => {
      onData(
        snap.docs
          .map((d) => mapLead(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
      );
    },
    (err) => onError?.(err),
  );
}

export async function saveLead(
  input: Omit<SalesLead, "id" | "updatedAt" | "createdAt"> & { id?: string },
): Promise<string> {
  const db = getFirebaseDb();
  const payload = {
    company: input.company.trim(),
    contactName: input.contactName?.trim() || "",
    email: input.email?.trim() || "",
    phone: input.phone?.trim() || "",
    status: input.status || "new",
    mode: input.mode || "air",
    lane: input.lane?.trim() || "",
    dealValue: input.dealValue ?? 0,
    nextAction: input.nextAction?.trim() || "",
    nextDueDate: input.nextDueDate || "",
    winLossReason: input.winLossReason?.trim() || "",
    owner: input.owner?.trim() || "",
    notes: input.notes?.trim() || "",
    updatedAt: serverTimestamp(),
  };
  if (input.id) {
    await updateDoc(doc(db, "leads", input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, "leads"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "leads", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteLead(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "leads", id));
}

export async function fetchLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const db = getFirebaseDb();
  try {
    const q = query(
      collection(db, "activities"),
      where("leadId", "==", leadId),
      orderBy("createdAt", "desc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapActivity(d.id, d.data() as Record<string, unknown>));
  } catch {
    const snap = await getDocs(collection(db, "activities"));
    return snap.docs
      .map((d) => mapActivity(d.id, d.data() as Record<string, unknown>))
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function addLeadActivity(
  leadId: string,
  body: string,
  createdBy: string,
  type: LeadActivity["type"] = "note",
): Promise<string> {
  const db = getFirebaseDb();
  const ref = await addDoc(collection(db, "activities"), {
    leadId,
    body: body.trim(),
    type,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
