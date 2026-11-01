"use client";

import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import type { ChatProfile } from "@/lib/chat/profile";
import { getFirebaseDb } from "./client";

const COLLECTION = "chatProfiles";

/** Everyone's photo and status, live. A few KB each; one listener for the whole chat. */
export function subscribeProfiles(onData: (list: ChatProfile[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), COLLECTION),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as Omit<ChatProfile, "login">), login: d.id }))),
    (err) => onError?.(err),
  );
}

/** Saves only this person's own record. Rules refuse anyone else's, and anything bigger than a small photo. */
export async function saveProfile(login: string, patch: Partial<Pick<ChatProfile, "photo" | "status">>): Promise<void> {
  const next: Record<string, unknown> = { login, updatedAt: Date.now() };
  if ("photo" in patch) next.photo = patch.photo ?? "";
  if ("status" in patch) {
    next.status = patch.status ?? "";
    next.statusAt = patch.status ? Date.now() : 0;
  }
  await setDoc(doc(getFirebaseDb(), COLLECTION, login), next, { merge: true });
}
