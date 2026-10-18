"use client";

/**
 * Files chosen while offline wait here (on this device) until the connection returns.
 * Messages themselves are held by the database's own offline copy; only the file bytes need this.
 */
import type { ChatAttachment } from "./types";

export interface OutboxItem {
  id: string; // `${msgId}:${index}`
  roomId: string;
  msgId: string;
  index: number;
  name: string;
  type: string;
  blob: Blob;
  /** All the message's attachments as last known, so finished uploads survive a retry of the rest. */
  template: ChatAttachment[];
  addedAt: number;
}

const DB_NAME = "atlas-chat-outbox";
const STORE = "files";

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function queueFile(item: OutboxItem): Promise<void> {
  await run("readwrite", (s) => s.put(item));
}

export async function queuedFiles(): Promise<OutboxItem[]> {
  return ((await run("readonly", (s) => s.getAll())) as OutboxItem[] | undefined) ?? [];
}

export async function dropFile(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export async function clearOutbox(): Promise<void> {
  await run("readwrite", (s) => s.clear());
}
