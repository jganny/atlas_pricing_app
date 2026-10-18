"use client";

/**
 * Team chat's own copy on this device (IndexedDB): the last chats and messages seen, and anything
 * written while offline that hasn't reached the server yet. Kept separate from the main database so
 * nothing else in the app is affected. Wiped on sign-out (except unsent items, which stay for their sender).
 */
import type { ChatMessage, ChatRoom, ChatState } from "./types";

const DB_NAME = "atlas-chat";
const STORES = ["rooms", "messages", "state", "queue", "pendingRooms"] as const;
type Store = (typeof STORES)[number];

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => STORES.forEach((s) => req.result.createObjectStore(s));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
const db = () => (dbPromise ??= open());

async function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(d.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

const put = (store: Store, key: string, value: unknown) => run(store, "readwrite", (s) => s.put(value, key)).then(() => undefined);
const get = <T,>(store: Store, key: string) => run(store, "readonly", (s) => s.get(key)) as Promise<T | undefined>;
const del = (store: Store, key: string) => run(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
const all = async <T,>(store: Store): Promise<T[]> => ((await run(store, "readonly", (s) => s.getAll())) as T[] | undefined) ?? [];

/** Strip the live-only flag before keeping a copy. */
const keep = (m: ChatMessage): ChatMessage => ({ ...m, pending: undefined });

export const saveRooms = (login: string, rooms: ChatRoom[]) => put("rooms", login, rooms);
export const loadRooms = async (login: string) => (await get<ChatRoom[]>("rooms", login)) ?? [];
export const saveMessages = (roomId: string, rows: ChatMessage[]) => put("messages", roomId, rows.slice(-200).map(keep));
export const loadMessages = async (roomId: string) => (await get<ChatMessage[]>("messages", roomId)) ?? [];
export const saveState = (login: string, s: ChatState) => put("state", login, s);
export const loadState = (login: string) => get<ChatState>("state", login);

export const queueMessage = (m: ChatMessage) => put("queue", m.id, keep(m));
export const queuedMessages = () => all<ChatMessage>("queue");
export const dropQueued = (id: string) => del("queue", id);

export const queueRoom = (r: ChatRoom) => put("pendingRooms", r.id, r);
export const queuedRooms = () => all<ChatRoom>("pendingRooms");
export const dropQueuedRoom = (id: string) => del("pendingRooms", id);

/** Removes everything seen on this device. Messages and rooms still waiting to be sent are left for their sender. */
export async function wipeChatCache(): Promise<void> {
  await Promise.all((["rooms", "messages", "state"] as const).map((s) => run(s, "readwrite", (st) => st.clear())));
}
