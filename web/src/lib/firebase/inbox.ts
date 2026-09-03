"use client";

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import type { InboxEnquiry } from "@/lib/types";
import { getFirebaseDb } from "./client";

function mapInbox(id: string, data: Record<string, unknown>): InboxEnquiry {
  return {
    id,
    mailbox: (data.mailbox as InboxEnquiry["mailbox"]) || "pricing",
    mailboxEmail: String(data.mailboxEmail ?? ""),
    messageId: data.messageId ? String(data.messageId) : undefined,
    from: String(data.from ?? ""),
    subject: String(data.subject ?? "(no subject)"),
    receivedAt: String(data.receivedAt ?? data.date ?? ""),
    bodyPreview: String(data.bodyPreview ?? "").slice(0, 280),
    body: String(data.body ?? data.bodyPreview ?? ""),
    mode: (data.mode as InboxEnquiry["mode"]) || "unknown",
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    assignedUsers: Array.isArray(data.assignedUsers) ? (data.assignedUsers as string[]) : [],
    suggestedUser: (data.suggestedUser as string) || null,
    claimedBy: (data.claimedBy as string) || null,
    status: (data.status as InboxEnquiry["status"]) || "new",
    parsed: (data.parsed as InboxEnquiry["parsed"]) || {
      customer: "",
      origin: "",
      destination: "",
      packages: [],
      containers: [],
      confidence: 0,
      source: "email-imap",
    },
  };
}

export async function fetchInboxEnquiries(max = 80): Promise<InboxEnquiry[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, "inbox_enquiries"), orderBy("timestamp", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapInbox(d.id, d.data() as Record<string, unknown>));
}

export function subscribeInboxEnquiries(
  onData: (rows: InboxEnquiry[]) => void,
  onError?: (err: Error) => void,
  max = 80,
): () => void {
  const db = getFirebaseDb();
  const q = query(collection(db, "inbox_enquiries"), orderBy("timestamp", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapInbox(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  );
}

export async function patchInboxEnquiry(
  id: string,
  patch: Partial<Pick<InboxEnquiry, "status" | "claimedBy">>,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "inbox_enquiries", id), {
    ...patch,
    updatedAt: Date.now(),
  });
}
