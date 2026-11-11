"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import type { SearchHit } from "@/lib/mail/search-view";

const fn = <I, O>(name: string, timeout = 120_000) => httpsCallable<I, O>(getFunctions(getFirebaseApp(), "us-central1"), name, { timeout });

export interface SearchRequest {
  query: string;
  mailbox: "both" | "pricing" | "pricingsales";
  folder: "both" | "inbox" | "sent";
  days: number;
}

/** Searches the real mailboxes (nothing is stored in the app). */
export async function searchMailboxes(req: SearchRequest): Promise<{ results: SearchHit[]; terms: string[]; days: number; failed: number }> {
  const res = await fn<SearchRequest, { results: SearchHit[]; terms: string[]; days: number; failed: number }>("searchMailboxes")(req);
  return res.data;
}

/** One mail found by the search, opened live as an .eml. */
export async function openMailboxEml(hit: Pick<SearchHit, "mailbox" | "folder" | "uid">): Promise<Uint8Array> {
  const res = await fn<{ mailbox: string; folder: string; uid: number }, { eml: string; truncated: boolean }>("openMailboxEmail", 90_000)(hit);
  if (res.data.truncated) throw new Error("This email is too large to read in full.");
  const bin = atob(res.data.eml);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
