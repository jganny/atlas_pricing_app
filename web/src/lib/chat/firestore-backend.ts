"use client";

/**
 * Team chat on Firestore. Writes are saved on the device first and sent when online
 * (the database keeps an on-device copy — see getFirebaseDb), so nothing here waits for the network.
 */
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase/client";
import { expiryFor, previewText, safeFileName, withReaction } from "./chat-logic";
import type { AuditEntry, ChatBackend, ChatMessage, ChatRoom, ChatState, Presence, Typing } from "./types";

/** Firestore refuses `undefined`, so drop it. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const roomRef = (id: string) => doc(getFirebaseDb(), "chatRooms", id);
const messages = (roomId: string) => collection(getFirebaseDb(), "chatRooms", roomId, "messages");

function toRoom(id: string, d: DocumentData): ChatRoom {
  return { ...(d as ChatRoom), id, memberLogins: d.memberLogins ?? [] };
}

function toMessage(id: string, roomId: string, d: DocumentData, pending: boolean): ChatMessage {
  const { expireAt: _expireAt, ...rest } = d;
  void _expireAt;
  return { ...(rest as ChatMessage), id, roomId, pending };
}

export const firestoreBackend: ChatBackend = {
  subscribeRooms(me, cb) {
    const db = getFirebaseDb();
    const mine = new Map<string, ChatRoom>();
    const everyone = new Map<string, ChatRoom>();
    const emit = () => cb([...new Map([...everyone, ...mine]).values()]);
    const apply = (target: Map<string, ChatRoom>) => (snap: { docs: Array<{ id: string; data: () => DocumentData }> }) => {
      target.clear();
      snap.docs.forEach((d) => target.set(d.id, toRoom(d.id, d.data())));
      emit();
    };
    const fail = (e: Error) => console.warn("Team chat rooms:", e.message);
    const u1 = onSnapshot(query(collection(db, "chatRooms"), where("memberLogins", "array-contains", me.login)), apply(mine), fail);
    const u2 = onSnapshot(query(collection(db, "chatRooms"), where("audience", "==", "all")), apply(everyone), fail);
    return () => {
      u1();
      u2();
    };
  },

  subscribeMessages(roomId, max, cb) {
    return onSnapshot(
      query(messages(roomId), orderBy("createdAtMs", "desc"), limitTo(max)),
      { includeMetadataChanges: true },
      (snap) => {
        const rows = snap.docs.map((d) => toMessage(d.id, roomId, d.data({ serverTimestamps: "estimate" }), d.metadata.hasPendingWrites));
        cb(rows.reverse());
      },
      (e) => console.warn("Team chat messages:", e.message),
    );
  },

  sendMessage(msg) {
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    const { pending: _pending, ...body } = msg;
    void _pending;
    batch.set(doc(messages(msg.roomId), msg.id), { ...clean(body), expireAt: Timestamp.fromMillis(expiryFor(msg.createdAtMs)) });
    const bump: Record<string, unknown> = {
      lastMessageAt: msg.createdAtMs,
      lastMessageText: previewText(msg),
      lastMessageBy: msg.senderLogin,
    };
    for (const login of msg.mentions ?? []) bump[`mentioned.${login}`] = msg.createdAtMs;
    batch.update(roomRef(msg.roomId), bump);
    // Not awaited on purpose: offline, this stays queued on the device and goes out later.
    batch.commit().catch((e) => console.warn("Team chat send:", e.message));
  },

  patchMessage(roomId, id, patch) {
    const { pending: _pending, ...rest } = patch;
    void _pending;
    void writeBatch(getFirebaseDb())
      .update(doc(messages(roomId), id), clean(rest) as DocumentData)
      .commit()
      .catch((e) => console.warn("Team chat edit:", e.message));
  },

  setReaction(roomId, id, emoji, login, on) {
    const db = getFirebaseDb();
    const target = doc(messages(roomId), id);
    // Reactions are small and shared, so merge the person into the current list from the latest copy we hold.
    const unsub = onSnapshot(target, { includeMetadataChanges: false }, (snap) => {
      unsub();
      const current = (snap.data()?.reactions ?? {}) as Record<string, string[]>;
      void writeBatch(db)
        .update(target, { reactions: withReaction(current, emoji, login, on) })
        .commit()
        .catch((e) => console.warn("Team chat reaction:", e.message));
    });
  },

  async createRoom(room) {
    // Saved on the device straight away and sent when online, so this must not wait for the server.
    setDoc(roomRef(room.id), clean(room)).catch((e) => console.warn("Team chat new room:", e.message));
  },

  patchRoom(roomId, patch) {
    void writeBatch(getFirebaseDb())
      .update(roomRef(roomId), clean(patch) as DocumentData)
      .commit()
      .catch((e) => console.warn("Team chat room:", e.message));
  },

  async syncDeskChannels(rooms) {
    const batch = writeBatch(getFirebaseDb());
    for (const r of rooms) {
      // Merge so the existing conversation (last message, pins) is left alone.
      batch.set(
        roomRef(r.id),
        clean({ kind: r.kind, name: r.name, audience: r.audience, memberLogins: r.memberLogins, seatId: r.seatId ?? null, createdBy: r.createdBy, createdAt: r.createdAt }),
        { merge: true },
      );
    }
    await batch.commit();
  },

  subscribeState(login, cb) {
    return onSnapshot(
      doc(getFirebaseDb(), "chatState", login),
      (snap) => {
        const d = (snap.data() ?? {}) as Partial<ChatState>;
        cb({ reads: d.reads ?? {}, muted: d.muted ?? {}, noticeAcceptedAt: d.noticeAcceptedAt, tokens: d.tokens });
      },
      (e) => console.warn("Team chat state:", e.message),
    );
  },

  saveState(login, patch) {
    const { addToken, ...rest } = patch as Record<string, unknown> & { addToken?: string };
    const data: Record<string, unknown> = { ...clean(rest) };
    if (addToken) data.tokens = arrayUnion(addToken);
    void setDoc(doc(getFirebaseDb(), "chatState", login), data, { merge: true }).catch((e) => console.warn("Team chat state:", e.message));
  },

  setTyping(roomId, login, name) {
    void setDoc(doc(getFirebaseDb(), "chatRooms", roomId, "typing", login), { login, name, at: Date.now() }).catch(() => undefined);
  },

  subscribeTyping(roomId, cb) {
    return onSnapshot(
      collection(getFirebaseDb(), "chatRooms", roomId, "typing"),
      (snap) => cb(snap.docs.map((d) => d.data() as Typing)),
      () => undefined,
    );
  },

  setReceipt(roomId, login) {
    void setDoc(doc(getFirebaseDb(), "chatRooms", roomId, "receipts", login), { login, at: Date.now() }).catch(() => undefined);
  },

  subscribeReceipts(roomId, cb) {
    return onSnapshot(
      collection(getFirebaseDb(), "chatRooms", roomId, "receipts"),
      (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, Number(d.data().at) || 0]))),
      () => undefined,
    );
  },

  heartbeat(login, name) {
    void setDoc(doc(getFirebaseDb(), "chatPresence", login), { login, name, at: Date.now() }).catch(() => undefined);
  },

  subscribePresence(cb) {
    return onSnapshot(
      collection(getFirebaseDb(), "chatPresence"),
      (snap) => cb(snap.docs.map((d) => d.data() as Presence)),
      () => undefined,
    );
  },

  subscribeAllRooms(cb) {
    return onSnapshot(
      collection(getFirebaseDb(), "chatRooms"),
      (snap) => cb(snap.docs.map((d) => toRoom(d.id, d.data()))),
      (e) => console.warn("Chat review rooms:", e.message),
    );
  },

  subscribeAudit(cb) {
    return onSnapshot(
      query(collection(getFirebaseDb(), "chatAudit"), orderBy("at", "desc"), limitTo(50)),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as AuditEntry), id: d.id }))),
      () => undefined,
    );
  },

  logReview(entry) {
    void setDoc(doc(getFirebaseDb(), "chatAudit", entry.id), clean(entry)).catch((e) => console.warn("Chat review log:", e.message));
  },

  async uploadFile(roomId, msgId, file, name, type) {
    const storage = getStorage(getFirebaseApp());
    const fileRef = ref(storage, `chat/${roomId}/${msgId}/${safeFileName(name)}`);
    await uploadBytes(fileRef, file, { contentType: type || undefined });
    return getDownloadURL(fileRef);
  },
};
