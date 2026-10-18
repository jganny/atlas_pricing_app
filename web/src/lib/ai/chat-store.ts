"use client";

/** Chat history: private to each person. Live app → Firestore (rules enforce the owner); demo/mock → this browser only. */
import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { useLiveData } from "@/lib/api";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import type { ChatMessage } from "./vertex-chat";

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const MOCK_KEY = "atlas_chat_threads_v1";
const MAX_THREADS = 40;
const MAX_MESSAGES = 60;

/** A message as stored: trimmed so a long chat never outgrows a database document. */
export function compactMessage(m: ChatMessage): ChatMessage {
  const out: ChatMessage = { id: m.id, role: m.role, content: m.content.slice(0, 24000), createdAt: m.createdAt };
  if (m.tags?.length) out.tags = m.tags;
  if (m.sources?.length) out.sources = m.sources.slice(0, 8);
  if (m.files?.length) out.files = m.files;
  if (m.error) out.error = m.error;
  return out;
}

export function compactThread(t: ChatThread): ChatThread {
  return { ...t, messages: t.messages.filter((m) => m.content || m.error).slice(-MAX_MESSAGES).map(compactMessage) };
}

function readMock(): ChatThread[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MOCK_KEY) || "[]");
    return Array.isArray(raw) ? (raw as ChatThread[]) : [];
  } catch {
    return [];
  }
}

const byNewest = (a: ChatThread, b: ChatThread) => b.updatedAt.localeCompare(a.updatedAt);

export async function listThreads(): Promise<ChatThread[]> {
  if (!useLiveData) return readMock().sort(byNewest).slice(0, MAX_THREADS);
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(getFirebaseDb(), "chatThreads"), where("owner", "==", uid)));
  return snap.docs
    .map((d) => ({ ...(d.data() as ChatThread), id: d.id }))
    .sort(byNewest)
    .slice(0, MAX_THREADS);
}

export async function saveThread(thread: ChatThread): Promise<void> {
  const t = compactThread(thread);
  if (!useLiveData) {
    const others = readMock().filter((x) => x.id !== t.id);
    try {
      localStorage.setItem(MOCK_KEY, JSON.stringify([t, ...others].slice(0, MAX_THREADS)));
    } catch {
      /* private mode */
    }
    return;
  }
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) return;
  await setDoc(doc(getFirebaseDb(), "chatThreads", t.id), JSON.parse(JSON.stringify({ ...t, owner: uid })));
}

export async function deleteThread(id: string): Promise<void> {
  if (!useLiveData) {
    try {
      localStorage.setItem(MOCK_KEY, JSON.stringify(readMock().filter((x) => x.id !== id)));
    } catch {
      /* private mode */
    }
    return;
  }
  await deleteDoc(doc(getFirebaseDb(), "chatThreads", id));
}
