"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { useLiveData } from "@/lib/api";
import { personDisplayName } from "@/lib/auth/desk-seats";
import { groupByDay, previewText, roomTitle, searchMessages, timeLabel } from "@/lib/chat/chat-logic";
import { firestoreBackend } from "@/lib/chat/firestore-backend";
import { mockBackend } from "@/lib/chat/mock-backend";
import { listPeople } from "@/lib/chat/people";
import type { AuditEntry, ChatMessage, ChatRoom } from "@/lib/chat/types";
import { useAuthStore } from "@/store/auth";

const backend = () => (useLiveData ? firestoreBackend : mockBackend);

/**
 * Administrator-only review of team chats, in the Admin area. Opening a chat is recorded in the review log
 * (who looked at which chat, and when) so access can be accounted for.
 */
export function ChatReviewAdmin() {
  const user = useAuthStore((s) => s.user);
  const me = (user?.username || "").toLowerCase();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [open, setOpen] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [q, setQ] = useState("");
  const people = useMemo(() => listPeople(), []);

  useEffect(() => {
    const b = backend();
    const u1 = b.subscribeAllRooms(setRooms);
    const u2 = b.subscribeAudit(setAudit);
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    return backend().subscribeMessages(open.id, 500, setMessages);
  }, [open]);

  function openRoom(r: ChatRoom) {
    backend().logReview({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, by: me, roomId: r.id, roomName: roomTitle(r, "", people), at: Date.now() });
    setOpen(r);
  }

  const shown = q.trim() ? searchMessages(messages, q).reverse() : messages;
  const groups = groupByDay(shown);
  const nameOf = (login: string) => personDisplayName(login);

  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="chat-review">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--color-atlas-navy)]">
        <Eye className="h-4 w-4" /> Team chat review
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        For administrators only. Each chat you open is added to the review log below. Messages and files are deleted automatically 100 days after they were sent.
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-[18rem_1fr]">
        <ul className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          {rooms.length === 0 ? <li className="px-3 py-6 text-center text-xs text-slate-500">No chats yet.</li> : null}
          {rooms.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => openRoom(r)} className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50 ${open?.id === r.id ? "bg-sky-50" : ""}`}>
                <span className="font-bold">
                  {r.kind === "dm" ? r.memberLogins.map(nameOf).join(" ↔ ") : r.name}
                </span>
                <span className="truncate text-xs text-slate-500">
                  {r.kind === "dm" ? "Direct" : r.kind === "group" ? `Group · ${r.memberLogins.length}` : "Desk chat"} · {r.lastMessageText || "no messages"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-h-[12rem] rounded-lg border border-slate-200">
          {open ? (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <span className="flex-1 truncate text-sm font-bold">{open.kind === "dm" ? open.memberLogins.map(nameOf).join(" ↔ ") : open.name}</span>
                <Search className="h-4 w-4 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-40 text-sm outline-none" aria-label="Search this chat" />
              </div>
              <div className="max-h-80 overflow-y-auto px-3 py-2 text-sm">
                {groups.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No messages.</p> : null}
                {groups.map((g) => (
                  <div key={g.key}>
                    <div className="my-1 text-center text-[11px] font-bold text-slate-400">{g.label}</div>
                    {g.items.map(({ msg }) => (
                      <p key={msg.id} className="py-0.5">
                        <span className="text-[11px] text-slate-400">{timeLabel(msg.createdAtMs)} </span>
                        <b>{msg.ai ? "Vertex" : nameOf(msg.senderLogin)}:</b> {msg.deleted ? <i className="text-slate-400">deleted</i> : previewText({ ...msg, text: msg.text })}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="px-4 py-10 text-center text-xs text-slate-500">Choose a chat to review.</p>
          )}
        </div>
      </div>
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer font-bold text-slate-600">Review log ({audit.length})</summary>
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {audit.length === 0 ? <li className="px-3 py-2 text-slate-500">No reviews yet.</li> : null}
          {audit.map((a) => (
            <li key={a.id} className="px-3 py-1.5">
              {new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — {nameOf(a.by)} opened “{a.roomName}”
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
