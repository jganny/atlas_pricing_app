"use client";

import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";

export type AmendmentStatus = "pending" | "approved" | "rejected";

export interface AmendmentRequest {
  id: string;
  quoteId: string;
  quoteRef?: string;
  customer?: string;
  requestedBy: string;
  reason?: string;
  status: AmendmentStatus;
  createdAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  grantUntil?: number;
}

function mapReq(id: string, data: Record<string, unknown>): AmendmentRequest {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined;
  let createdAtStr = "";
  if (createdAt && typeof createdAt === "object" && typeof createdAt.toDate === "function") {
    createdAtStr = createdAt.toDate().toISOString();
  } else if (typeof createdAt === "string") createdAtStr = createdAt;
  return {
    id,
    quoteId: String(data.quoteId ?? ""),
    quoteRef: data.quoteRef ? String(data.quoteRef) : "",
    customer: data.customer ? String(data.customer) : "",
    requestedBy: String(data.requestedBy ?? ""),
    reason: data.reason ? String(data.reason) : "",
    status: (String(data.status || "pending") as AmendmentStatus) || "pending",
    createdAt: createdAtStr,
    resolvedAt: data.resolvedAt ? String(data.resolvedAt) : "",
    resolvedBy: data.resolvedBy ? String(data.resolvedBy) : "",
    grantUntil: typeof data.grantUntil === "number" ? data.grantUntil : undefined,
  };
}

const LOCAL_KEY = "gl_amendment_requests";

export function loadLocalAmendments(): AmendmentRequest[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLocalAmendments(rows: AmendmentRequest[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
}

export async function fetchAmendmentRequests(): Promise<AmendmentRequest[]> {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, "amendment_requests"));
    const rows = snap.docs.map((d) => mapReq(d.id, d.data() as Record<string, unknown>));
    if (rows.length) {
      saveLocalAmendments(rows);
      return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
  } catch {
    /* fall through */
  }
  return loadLocalAmendments().sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || ""),
  );
}

export async function requestAmendment(input: {
  quoteId: string;
  quoteRef?: string;
  customer?: string;
  requestedBy: string;
  reason?: string;
}): Promise<string> {
  const payload = {
    quoteId: input.quoteId,
    quoteRef: input.quoteRef || "",
    customer: input.customer || "",
    requestedBy: input.requestedBy,
    reason: input.reason || "",
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  try {
    const db = getFirebaseDb();
    const ref = await addDoc(collection(db, "amendment_requests"), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    const row = { id: ref.id, ...payload };
    saveLocalAmendments([row, ...loadLocalAmendments().filter((r) => r.id !== ref.id)]);
    return ref.id;
  } catch {
    const id = `amd-local-${Date.now()}`;
    const row = { id, ...payload };
    saveLocalAmendments([row, ...loadLocalAmendments()]);
    return id;
  }
}

export async function resolveAmendment(
  id: string,
  status: "approved" | "rejected",
  resolvedBy: string,
): Promise<void> {
  const grantUntil = status === "approved" ? Date.now() + 2 * 60 * 60 * 1000 : undefined;
  const patch = {
    status,
    resolvedBy,
    resolvedAt: new Date().toISOString(),
    grantUntil: grantUntil ?? null,
  };
  try {
    const db = getFirebaseDb();
    await updateDoc(doc(db, "amendment_requests", id), {
      ...patch,
      resolvedAt: serverTimestamp(),
    });
  } catch {
    /* local only */
  }
  saveLocalAmendments(
    loadLocalAmendments().map((r) => (r.id === id ? { ...r, ...patch, grantUntil } : r)),
  );
}

export function isAmendmentGrantActive(quoteId: string, username: string): boolean {
  const now = Date.now();
  return loadLocalAmendments().some(
    (r) =>
      r.quoteId === quoteId &&
      r.status === "approved" &&
      r.requestedBy === username &&
      typeof r.grantUntil === "number" &&
      r.grantUntil > now,
  );
}
