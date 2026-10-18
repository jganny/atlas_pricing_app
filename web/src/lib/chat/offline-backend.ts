"use client";

/**
 * Makes team chat work without a connection, without touching the rest of the app's database setup.
 * - Reading: the last chats and messages seen are shown straight away from this device, then replaced
 *   by live data as soon as it arrives.
 * - Writing: a message (or a new chat) is saved on the device first and shown as "waiting to send";
 *   it is delivered when the connection returns — even if the app was closed in between.
 */
import * as cache from "./chat-cache";
import { deliverMessage, deliverRoom, firestoreBackend } from "./firestore-backend";
import { withReaction } from "./chat-logic";
import type { ChatBackend, ChatMessage, ChatRoom, ChatState } from "./types";

const queue = new Map<string, ChatMessage>();
const pendingRooms = new Map<string, ChatRoom>();
const watchers = new Set<() => void>();
const notify = () => watchers.forEach((w) => w());
let activeLogin = "";
let loaded: Promise<void> | null = null;
let started = false;
let flushing = false;

function ensureLoaded(): Promise<void> {
  return (loaded ??= (async () => {
    for (const m of await cache.queuedMessages()) if (!queue.has(m.id)) queue.set(m.id, m);
    for (const r of await cache.queuedRooms()) if (!pendingRooms.has(r.id)) pendingRooms.set(r.id, r);
    notify();
  })());
}

const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "timeout" })), ms));

/** Delivers anything waiting, oldest first. Safe to call whenever. */
async function flush(): Promise<void> {
  if (flushing || !activeLogin || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  flushing = true;
  try {
    await ensureLoaded();
    for (const r of [...pendingRooms.values()]) {
      if (r.createdBy !== activeLogin && !r.memberLogins.includes(activeLogin)) continue;
      try {
        await Promise.race([deliverRoom(r), timeout(20_000)]);
        pendingRooms.delete(r.id);
        await cache.dropQueuedRoom(r.id);
      } catch {
        return; // try again later
      }
    }
    const mine = [...queue.values()].filter((m) => m.senderLogin === activeLogin && !m.failed).sort((a, b) => a.createdAtMs - b.createdAtMs);
    for (const m of mine) {
      try {
        await Promise.race([deliverMessage(m), timeout(20_000)]);
        queue.delete(m.id);
        await cache.dropQueued(m.id);
      } catch (e) {
        if (String((e as { code?: string }).code) === "permission-denied") {
          const failed = { ...m, failed: true };
          queue.set(m.id, failed);
          await cache.queueMessage(failed);
          notify();
          continue;
        }
        return; // connection trouble — keep it and try again later
      }
    }
  } finally {
    flushing = false;
    notify();
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void flush());
  window.setInterval(() => void flush(), 20_000);
}

function mergeRoomMessages(roomId: string, server: ChatMessage[]): ChatMessage[] {
  const have = new Set(server.map((m) => m.id));
  const waiting = [...queue.values()].filter((m) => m.roomId === roomId && !have.has(m.id)).map((m) => ({ ...m, pending: !m.failed }));
  return [...server, ...waiting];
}

// The person's own read marks / muted chats, kept locally too so they work offline.
const localState = new Map<string, ChatState>();
const stateWatchers = new Map<string, Set<() => void>>();
const stateOf = (login: string): ChatState => localState.get(login) ?? { reads: {}, muted: {} };

function mergeState(server: ChatState, local: ChatState): ChatState {
  const reads = { ...server.reads };
  for (const [room, at] of Object.entries(local.reads)) reads[room] = Math.max(reads[room] ?? 0, at);
  return {
    reads,
    muted: { ...local.muted, ...server.muted },
    noticeAcceptedAt: server.noticeAcceptedAt ?? local.noticeAcceptedAt,
    tokens: server.tokens,
  };
}

export const offlineBackend: ChatBackend = {
  ...firestoreBackend,

  subscribeRooms(me, cb) {
    activeLogin = me.login;
    start();
    void ensureLoaded().then(() => flush());
    let server: ChatRoom[] | null = null;
    let cached: ChatRoom[] = [];
    let cacheLoaded = false;
    const emit = () => {
      const base = server ?? cached;
      const have = new Set(base.map((r) => r.id));
      const waiting = [...pendingRooms.values()].filter((r) => !have.has(r.id) && (r.createdBy === me.login || r.memberLogins.includes(me.login)));
      cb([...base, ...waiting]);
    };
    void cache.loadRooms(me.login).then((c) => {
      cacheLoaded = true;
      if (server === null && c.length) {
        cached = c;
        emit();
      }
    });
    // Nothing live and nothing saved after a few seconds (e.g. offline on a brand-new device): show an empty list.
    const idle = window.setTimeout(() => {
      if (server === null && cacheLoaded) emit();
    }, 3000);
    const un = firestoreBackend.subscribeRooms(me, (rows) => {
      server = rows;
      void cache.saveRooms(me.login, rows);
      emit();
    });
    watchers.add(emit);
    return () => {
      window.clearTimeout(idle);
      watchers.delete(emit);
      un();
    };
  },

  subscribeMessages(roomId, max, cb) {
    let server: ChatMessage[] | null = null;
    let standIn: ChatMessage[] = []; // what this device saw last time, shown until live data arrives
    const emit = () => cb(mergeRoomMessages(roomId, server ?? standIn));
    void ensureLoaded().then(() => {
      void cache.loadMessages(roomId).then((c) => {
        if (server === null && c.length) {
          standIn = c;
          emit();
        }
      });
    });
    const un = firestoreBackend.subscribeMessages(roomId, max, (rows) => {
      server = rows;
      void cache.saveMessages(roomId, rows);
      // Anything the server has now confirmed no longer needs to wait on this device.
      for (const r of rows) {
        if (!r.pending && queue.has(r.id)) {
          queue.delete(r.id);
          void cache.dropQueued(r.id);
        }
      }
      emit();
    });
    watchers.add(emit);
    return () => {
      watchers.delete(emit);
      un();
    };
  },

  sendMessage(msg) {
    queue.set(msg.id, msg);
    void cache.queueMessage(msg);
    notify();
    void flush();
  },

  patchMessage(roomId, id, patch) {
    const waiting = queue.get(id);
    if (waiting) {
      const next = { ...waiting, ...patch } as ChatMessage;
      queue.set(id, next);
      void cache.queueMessage(next);
      notify();
      return;
    }
    firestoreBackend.patchMessage(roomId, id, patch);
  },

  setReaction(roomId, id, emoji, login, on) {
    const waiting = queue.get(id);
    if (waiting) {
      const next = { ...waiting, reactions: withReaction(waiting.reactions, emoji, login, on) };
      queue.set(id, next);
      void cache.queueMessage(next);
      notify();
      return;
    }
    firestoreBackend.setReaction(roomId, id, emoji, login, on);
  },

  async createRoom(room) {
    pendingRooms.set(room.id, room);
    await cache.queueRoom(room);
    notify();
    void flush();
  },

  subscribeState(login, cb) {
    let server: ChatState | null = null;
    const emit = () => cb(server ? mergeState(server, stateOf(login)) : stateOf(login));
    void cache.loadState(login).then((c) => {
      if (c && !localState.has(login)) localState.set(login, c);
      if (server === null && c) emit();
    });
    const set = stateWatchers.get(login) ?? new Set();
    set.add(emit);
    stateWatchers.set(login, set);
    const un = firestoreBackend.subscribeState(login, (s) => {
      server = s;
      const merged = mergeState(s, stateOf(login));
      localState.set(login, merged);
      void cache.saveState(login, merged);
      // If this device accepted the notice offline and the server never heard, tell it now.
      if (merged.noticeAcceptedAt !== undefined && s.noticeAcceptedAt === undefined) firestoreBackend.saveState(login, { noticeAcceptedAt: merged.noticeAcceptedAt });
      emit();
    });
    return () => {
      set.delete(emit);
      un();
    };
  },

  saveState(login, patch) {
    const p = patch as Partial<ChatState> & { addToken?: string };
    const cur = stateOf(login);
    const next: ChatState = {
      ...cur,
      reads: { ...cur.reads, ...(p.reads ?? {}) },
      muted: { ...cur.muted, ...(p.muted ?? {}) },
      noticeAcceptedAt: p.noticeAcceptedAt ?? cur.noticeAcceptedAt,
    };
    localState.set(login, next);
    void cache.saveState(login, next);
    stateWatchers.get(login)?.forEach((w) => w());
    firestoreBackend.saveState(login, patch);
  },
};
