"use client";

/**
 * Team chat for the public demo and offline development: everything stays in this browser.
 * It speaks the same interface as the live store, so the screen is identical.
 */
import { personDisplayName } from "@/lib/auth/desk-seats";
import { EVERYONE_ROOM, newId, previewText, withReaction } from "./chat-logic";
import type { AuditEntry, ChatBackend, ChatMessage, ChatRoom, ChatState, Presence, Typing } from "./types";

interface Store {
  rooms: Record<string, ChatRoom>;
  messages: Record<string, ChatMessage[]>;
  states: Record<string, ChatState>;
}

const KEY = "atlas_chat_mock_v1";
const listeners = new Set<() => void>();
let cache: Store | null = null;

const empty = (): Store => ({ rooms: {}, messages: {}, states: {} });

function load(): Store {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Store | null;
    cache = raw && raw.rooms ? raw : empty();
  } catch {
    cache = empty();
  }
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode — the in-memory copy still works for this visit */
  }
  listeners.forEach((l) => l());
}

function watch(fn: () => void) {
  listeners.add(fn);
  fn();
  return () => {
    listeners.delete(fn);
  };
}

/** A few sample conversations so the demo opens on something real-looking. */
export function seedDemo(store: Store, now = Date.now()): void {
  const MIN = 60_000;
  const room = (r: Partial<ChatRoom> & Pick<ChatRoom, "id" | "kind" | "name">): ChatRoom => ({
    audience: "list", memberLogins: [], createdBy: "ganny", createdAt: now - 3 * 86_400_000, ...r,
  });
  const rooms: ChatRoom[] = [
    room({ id: EVERYONE_ROOM, kind: "channel", name: "Everyone", audience: "all" }),
    room({ id: "desk_air-nom", kind: "channel", name: "Air Desk", seatId: "air-nom", memberLogins: ["shashank", "ganny"] }),
    room({ id: "desk_sea-nom", kind: "channel", name: "Sea Desk", seatId: "sea-nom", memberLogins: ["shaheer", "ganny"] }),
    room({ id: "desk_nrs", kind: "channel", name: "Priority Desk", seatId: "nrs", memberLogins: ["cathrina", "ganny"] }),
    room({ id: "g_reefer", kind: "group", name: "Reefer pricing", memberLogins: ["shaheer", "shashank", "ganny"] }),
  ];
  const lines: Array<[string, string, string, number, Partial<ChatMessage>?]> = [
    [EVERYONE_ROOM, "ganny", "Welcome to team chat. Share rates, files and quotes here — or use @Vertex to ask the assistant.", 3 * 24 * 60],
    [EVERYONE_ROOM, "shashank", "Carrier circular for the November fuel surcharge is uploaded in Circulars.", 26 * 60],
    ["desk_air-nom", "shashank", "Pearl Cargo asked for a revised rate on 1 pallet BLR → CMB. Re-pricing now.", 5 * 60, {
      quote: { id: "demo-q1", ref: "AE-0412", customer: "Pearl Cargo Ltd", mode: "air", route: "BLR → CMB", status: "quoted" },
    }],
    ["desk_air-nom", "ganny", "Thanks — please send it before 4 pm.", 4 * 60 + 40],
    ["g_reefer", "shaheer", "Do we have a 40' reefer rate to Jebel Ali for November?", 90],
    ["g_reefer", "shashank", "Checking with the line now.", 80],
  ];
  for (const [roomId, login, text, minsAgo, extra] of lines) {
    const at = now - minsAgo * MIN;
    const m: ChatMessage = { id: newId(), roomId, senderLogin: login, senderName: personDisplayName(login), text, createdAtMs: at, ...extra };
    (store.messages[roomId] ??= []).push(m);
    const r = rooms.find((x) => x.id === roomId);
    if (r) {
      r.lastMessageAt = at;
      r.lastMessageText = previewText(m);
      r.lastMessageBy = login;
    }
  }
  rooms.forEach((r) => (store.rooms[r.id] = r));
}

export const mockBackend: ChatBackend = {
  subscribeRooms(me, cb) {
    return watch(() => {
      const s = load();
      if (!Object.keys(s.rooms).length) {
        seedDemo(s);
        save();
        return;
      }
      // The demo is one person on one device, so they are placed in every sample room.
      cb(Object.values(s.rooms).map((r) => (r.audience === "all" ? r : { ...r, memberLogins: [...new Set([...r.memberLogins, me.login])] })));
    });
  },

  subscribeMessages(roomId, max, cb) {
    return watch(() => cb([...(load().messages[roomId] ?? [])].sort((a, b) => a.createdAtMs - b.createdAtMs).slice(-max)));
  },

  sendMessage(msg) {
    const s = load();
    (s.messages[msg.roomId] ??= []).push({ ...msg, pending: false });
    const r = s.rooms[msg.roomId];
    if (r) {
      r.lastMessageAt = msg.createdAtMs;
      r.lastMessageText = previewText(msg);
      r.lastMessageBy = msg.senderLogin;
      for (const l of msg.mentions ?? []) (r.mentioned ??= {})[l] = msg.createdAtMs;
    }
    save();
  },

  patchMessage(roomId, id, patch) {
    const s = load();
    s.messages[roomId] = (s.messages[roomId] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m));
    save();
  },

  setReaction(roomId, id, emoji, login, on) {
    const s = load();
    s.messages[roomId] = (s.messages[roomId] ?? []).map((m) => (m.id === id ? { ...m, reactions: withReaction(m.reactions, emoji, login, on) } : m));
    save();
  },

  async createRoom(room) {
    load().rooms[room.id] = room;
    save();
  },

  patchRoom(roomId, patch) {
    const s = load();
    if (s.rooms[roomId]) s.rooms[roomId] = { ...s.rooms[roomId], ...patch } as ChatRoom;
    save();
  },

  async syncDeskChannels() {
    /* the demo's desk channels are fixed */
  },

  subscribeState(login, cb) {
    return watch(() => {
      const s = load().states[login];
      cb({ reads: s?.reads ?? {}, muted: s?.muted ?? {}, noticeAcceptedAt: s?.noticeAcceptedAt, tokens: s?.tokens });
    });
  },

  saveState(login, patch) {
    const s = load();
    const cur = s.states[login] ?? { reads: {}, muted: {} };
    const { reads, muted, noticeAcceptedAt } = patch as Partial<ChatState>;
    s.states[login] = {
      ...cur,
      reads: { ...cur.reads, ...(reads ?? {}) },
      muted: { ...cur.muted, ...(muted ?? {}) },
      noticeAcceptedAt: noticeAcceptedAt ?? cur.noticeAcceptedAt,
    };
    save();
  },

  setTyping() {},
  subscribeTyping(_roomId: string, cb: (t: Typing[]) => void) {
    cb([]);
    return () => undefined;
  },
  setReceipt() {},
  subscribeReceipts(_roomId: string, cb: (m: Record<string, number>) => void) {
    cb({});
    return () => undefined;
  },
  heartbeat() {},
  subscribePresence(cb: (p: Presence[]) => void) {
    cb([]);
    return () => undefined;
  },

  subscribeAllRooms(cb) {
    return watch(() => cb(Object.values(load().rooms)));
  },
  subscribeAudit(cb: (rows: AuditEntry[]) => void) {
    return watch(() => {
      try {
        cb(JSON.parse(localStorage.getItem(`${KEY}_audit`) || "[]") as AuditEntry[]);
      } catch {
        cb([]);
      }
    });
  },
  logReview(entry) {
    try {
      const rows = JSON.parse(localStorage.getItem(`${KEY}_audit`) || "[]") as AuditEntry[];
      localStorage.setItem(`${KEY}_audit`, JSON.stringify([entry, ...rows].slice(0, 50)));
    } catch {
      /* private mode */
    }
    listeners.forEach((l) => l());
  },

  async uploadFile(_roomId, _msgId, file) {
    // Held for this visit only; the demo doesn't keep uploaded files.
    return URL.createObjectURL(file);
  },
};
