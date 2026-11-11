"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import type { EmailContact } from "@/lib/directory/email-directory";

const fn = <I, O>(name: string) => httpsCallable<I, O>(getFunctions(getFirebaseApp(), "us-central1"), name, { timeout: 60_000 });

/** Every address in the directory (any signed-in person). */
export async function fetchEmailContacts(): Promise<EmailContact[]> {
  const res = await fn<Record<string, never>, { contacts: EmailContact[] }>("directoryList")({});
  return res.data.contacts;
}

export type ContactPatch = Partial<Pick<EmailContact, "type" | "org" | "name" | "carrierCode" | "rateSource" | "note">> & { remove?: boolean };

/** Change one contact (admin only). */
export async function updateEmailContact(id: string, patch: ContactPatch): Promise<void> {
  await fn<{ id: string } & ContactPatch, { ok: boolean }>("directoryUpdate")({ id, ...patch });
}
