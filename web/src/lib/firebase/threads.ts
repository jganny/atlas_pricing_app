"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import type { ThreadView } from "@/lib/mail/thread-view";

const fn = <I, O>(name: string) => httpsCallable<I, O>(getFunctions(getFirebaseApp(), "us-central1"), name, { timeout: 60_000 });

/** The conversation behind an Inbox item: the enquiry, what was sent on to vendors, the replies. */
export async function fetchThread(id: string): Promise<ThreadView> {
  const res = await fn<{ id: string }, ThreadView>("threadGet")({ id });
  return res.data;
}

/** This email does not belong to that conversation. It is not tied in again by itself. */
export async function unlinkFromThread(kind: "card" | "sent", id: string): Promise<void> {
  await fn<{ kind: string; id: string }, { ok: boolean }>("threadUnlink")({ kind, id });
}

/** This email belongs to that enquiry (by hand, when the rules were not sure). */
export async function linkToEnquiry(kind: "card" | "sent", id: string, rootId: string): Promise<void> {
  await fn<{ kind: string; id: string; rootId: string }, { ok: boolean }>("threadLink")({ kind, id, rootId });
}
