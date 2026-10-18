"use client";

/** Team chat — the things a person does: send, edit, delete, react, pin, upload. */
import { asksVertex, checkFile, newId, parseMentions, safeFileName, MAX_TEXT } from "./chat-logic";
import { dropFile, queueFile, queuedFiles } from "./outbox";
import type { ChatAttachment, ChatBackend, ChatMessage, ChatRoom, Me, Person, QuoteCard } from "./types";

export interface SendInput {
  backend: ChatBackend;
  me: Me;
  room: ChatRoom;
  people: Person[];
  text: string;
  files?: File[];
  replyTo?: ChatMessage;
  quote?: QuoteCard;
}

/** Saves the message on this device straight away; files and delivery continue in the background. */
export function sendChatMessage(input: SendInput): ChatMessage | null {
  const { backend, me, room, people, files = [], replyTo, quote } = input;
  const text = input.text.trim().slice(0, MAX_TEXT);
  if (!text && !files.length && !quote) return null;
  const id = newId();
  const attachments: ChatAttachment[] = files.map((f) => ({
    name: safeFileName(f.name),
    size: f.size,
    type: f.type || "",
    url: "",
    status: "uploading",
  }));
  const mentions = parseMentions(text, people).filter((l) => l !== me.login);
  const msg: ChatMessage = {
    id,
    roomId: room.id,
    senderLogin: me.login,
    senderName: me.name,
    text,
    createdAtMs: Date.now(),
    ...(attachments.length ? { attachments } : {}),
    ...(quote ? { quote } : {}),
    ...(mentions.length ? { mentions } : {}),
    ...(replyTo
      ? {
          replyTo: {
            id: replyTo.id,
            name: replyTo.ai ? "Vertex" : replyTo.senderName,
            snippet: (replyTo.text || replyTo.attachments?.[0]?.name || "").slice(0, 100),
          },
        }
      : {}),
  };
  backend.sendMessage(msg);
  if (files.length) {
    void Promise.all(
      files.map((blob, index) =>
        queueFile({ id: `${id}:${index}`, roomId: room.id, msgId: id, index, name: attachments[index].name, type: attachments[index].type, blob, addedAt: Date.now(), template: attachments }),
      ),
    ).then(() => processOutbox(backend));
  }
  return msg;
}

/** A reply written by the assistant on someone's behalf. Shown as Vertex; the asker's login is what owns the message. */
export function sendAssistantReply(backend: ChatBackend, me: Me, room: ChatRoom, text: string, replyTo: ChatMessage): void {
  backend.sendMessage({
    id: newId(),
    roomId: room.id,
    senderLogin: me.login,
    senderName: "Vertex",
    ai: true,
    text: text.slice(0, MAX_TEXT),
    createdAtMs: Date.now(),
    replyTo: { id: replyTo.id, name: replyTo.senderName, snippet: replyTo.text.slice(0, 100) },
  });
}

export function shouldAskVertex(text: string): boolean {
  return asksVertex(text);
}

export function validateFiles(files: File[]): { ok: File[]; problems: string[] } {
  const ok: File[] = [];
  const problems: string[] = [];
  for (const f of files) {
    const p = checkFile(f);
    if (p) problems.push(p);
    else ok.push(f);
  }
  return { ok, problems };
}

export function editMessage(backend: ChatBackend, msg: ChatMessage, text: string, people: Person[]): void {
  const clean = text.trim().slice(0, MAX_TEXT);
  if (!clean || clean === msg.text) return;
  backend.patchMessage(msg.roomId, msg.id, { text: clean, editedAtMs: Date.now(), mentions: parseMentions(clean, people) });
}

/** The message stays as a quiet "deleted" line so replies to it still make sense. */
export function deleteMessage(backend: ChatBackend, msg: ChatMessage): void {
  backend.patchMessage(msg.roomId, msg.id, { deleted: true, text: "", attachments: [], quote: null as never });
}

export function togglePin(backend: ChatBackend, room: ChatRoom, msgId: string): void {
  const pins = room.pinned ?? [];
  backend.patchRoom(room.id, { pinned: pins.includes(msgId) ? pins.filter((p) => p !== msgId) : [...pins, msgId].slice(-20) });
}

let processing = false;
const FATAL = new Set(["storage/unauthorized", "storage/quota-exceeded", "storage/invalid-argument", "storage/object-not-found", "storage/unauthenticated"]);

/** Sends any files that were waiting for a connection. Safe to call often. */
export async function processOutbox(backend: ChatBackend): Promise<void> {
  if (processing || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  processing = true;
  try {
    const items = (await queuedFiles()).sort((a, b) => a.addedAt - b.addedAt);
    for (const item of items) {
      const current = item.template.map((a) => ({ ...a }));
      try {
        const url = await backend.uploadFile(item.roomId, item.msgId, item.blob, item.name, item.type);
        current[item.index] = { ...current[item.index], url, status: "ready" };
      } catch (e) {
        const code = String((e as { code?: string }).code || "");
        if (!FATAL.has(code)) continue; // a connection problem — try again later
        current[item.index] = { ...current[item.index], status: "failed" };
      }
      backend.patchMessage(item.roomId, item.msgId, { attachments: current });
      await dropFile(item.id);
      // Hand the updated list to the message's other waiting files.
      for (const sibling of items) {
        if (sibling.msgId === item.msgId && sibling.id !== item.id) {
          sibling.template = current;
          await queueFile(sibling);
        }
      }
    }
  } finally {
    processing = false;
  }
}
