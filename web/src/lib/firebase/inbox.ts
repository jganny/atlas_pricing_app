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
  deleteDoc,
} from "firebase/firestore";
import type { InboxEnquiry, InboxTag } from "@/lib/types";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseDb } from "./client";

const TAGS = new Set(["new_enquiry", "follow_up", "needs_human"]);

function mapInbox(id: string, data: Record<string, unknown>): InboxEnquiry {
  const tagRaw = data.tag ? String(data.tag) : "";
  const tag = TAGS.has(tagRaw) ? (tagRaw as InboxTag) : undefined;

  return {
    id,
    mailbox: (data.mailbox as InboxEnquiry["mailbox"]) || "pricing",
    mailboxEmail: String(data.mailboxEmail ?? ""),
    messageId: data.messageId ? String(data.messageId) : undefined,
    from: String(data.from ?? ""),
    subject: String(data.subject ?? "(no subject)"),
    receivedAt: String(data.receivedAt ?? data.date ?? ""),
    bodyPreview: String(data.bodyPreview ?? "").slice(0, 280),
    body: String(data.body || data.bodyPreview || ""),
    mode: (data.mode as InboxEnquiry["mode"]) || "unknown",
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    assignedUsers: Array.isArray(data.assignedUsers) ? (data.assignedUsers as string[]) : [],
    suggestedUser: (data.suggestedUser as string) || null,
    claimedBy: (data.claimedBy as string) || null,
    status: (data.status as InboxEnquiry["status"]) || "new",
    tag,
    actionRequired: data.actionRequired !== false,
    reason: data.reason ? String(data.reason) : undefined,
    summary: data.summary ? String(data.summary) : undefined,
    classifier: data.classifier ? String(data.classifier) : undefined,
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
  patch: Partial<Pick<InboxEnquiry, "status" | "claimedBy" | "actionRequired">>,
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "inbox_enquiries", id), {
    ...patch,
    updatedAt: Date.now(),
  });
}

/**
 * The whole email behind an Inbox item (body and attachments, as a raw .eml), fetched from the mailbox when somebody actions it.
 * No AI credit: the reading comes after, once, in the Quote Hub reader.
 */
export async function fetchInboxEml(id: string): Promise<Uint8Array> {
  const call = httpsCallable<{ id: string }, { eml: string; size: number; truncated: boolean }>(getFunctions(getFirebaseApp(), "us-central1"), "fetchInboxEmail", { timeout: 90_000 });
  const res = await call({ id });
  if (res.data.truncated) throw new Error("This email is too large to read in full.");
  const bin = atob(res.data.eml);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Removes an item from the app (the email itself stays in the mailbox). Used when its quote is saved or it is set aside, so
 * nothing stays stored longer than it is needed. Never throws: a failure just leaves it for the daily clean-up.
 */
export async function removeInboxItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(getFirebaseDb(), "inbox_enquiries", id));
  } catch {
    /* the daily clean-up removes it */
  }
}
