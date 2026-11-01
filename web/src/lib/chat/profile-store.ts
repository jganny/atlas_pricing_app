"use client";

/** Where profiles live: the database in the real app, this browser in the demo. Same two calls either way. */
import { useLiveData } from "@/lib/api";
import { saveProfile as saveLive, subscribeProfiles as subscribeLive } from "@/lib/firebase/chat-profiles";
import type { ChatProfile } from "./profile";

const KEY = "atlas_demo_chat_profiles";
const EVENT = "atlas-demo-chat-profiles";

function readLocal(): Record<string, ChatProfile> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, ChatProfile>;
  } catch {
    return {};
  }
}

export function subscribeProfiles(cb: (list: ChatProfile[]) => void): () => void {
  if (useLiveData) return subscribeLive(cb, (e) => console.warn("Chat profiles:", e.message));
  const push = () => cb(Object.values(readLocal()));
  push();
  window.addEventListener(EVENT, push);
  return () => window.removeEventListener(EVENT, push);
}

export async function saveMyProfile(login: string, patch: Partial<Pick<ChatProfile, "photo" | "status">>): Promise<void> {
  if (useLiveData) return saveLive(login, patch);
  const all = readLocal();
  const cur: ChatProfile = all[login] ?? { login };
  if ("photo" in patch) cur.photo = patch.photo || undefined;
  if ("status" in patch) {
    cur.status = patch.status || undefined;
    cur.statusAt = patch.status ? Date.now() : undefined;
  }
  all[login] = cur;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT));
}
