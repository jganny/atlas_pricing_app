"use client";

import { useMemo, useState } from "react";
import { BellRing, Hash, Plus, Search, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import { hasUnread, isOnline, roomTitle, sectionsFor, timeLabel, wasMentioned } from "@/lib/chat/chat-logic";
import type { PushState } from "@/lib/chat/push";
import type { ChatRoom, ChatState, Person, Presence } from "@/lib/chat/types";

export function RoomList({
  rooms,
  activeId,
  me,
  people,
  presence,
  state,
  push,
  onPick,
  onNew,
  onEnablePush,
}: {
  rooms: ChatRoom[];
  activeId: string | null;
  me: string;
  people: Person[];
  presence: Record<string, Presence>;
  state: ChatState;
  push: PushState;
  onPick: (id: string) => void;
  onNew: () => void;
  onEnablePush: () => void;
}) {
  const [q, setQ] = useState("");
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sectionsFor(rooms)
      .map((s) => ({ ...s, rooms: s.rooms.filter((r) => !needle || roomTitle(r, me, people).toLowerCase().includes(needle) || (r.lastMessageText ?? "").toLowerCase().includes(needle)) }))
      .filter((s) => s.rooms.length > 0);
  }, [rooms, q, me, people]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-3">
        <h1 className="flex-1 text-base font-extrabold text-[var(--color-atlas-navy)]">Team chat</h1>
        <button type="button" onClick={onNew} aria-label="New chat" title="New direct message or group" data-testid="chat-new" className="flex h-8 items-center gap-1 rounded-full bg-[var(--color-atlas-navy)] px-3 text-xs font-bold text-white">
          <Plus className="h-4 w-4" /> New
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search chats" />
        </div>
      </div>
      {push === "off" ? (
        <button type="button" onClick={onEnablePush} className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs text-sky-900 hover:bg-sky-100">
          <BellRing className="h-4 w-4 shrink-0" />
          <span>
            <b>Get alerts</b> even when Atlas is closed. Tap to turn on notifications.
          </span>
        </button>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {sections.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No chats yet. Press <b>New</b> to message a colleague.</p> : null}
        {sections.map((s) => (
          <div key={s.key}>
            <div className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.title}</div>
            {s.rooms.map((r) => {
              const unread = hasUnread(r, state, me);
              const mentioned = wasMentioned(r, state, me);
              const muted = !!state.muted[r.id];
              const title = roomTitle(r, me, people);
              const other = r.kind === "dm" ? r.memberLogins.find((l) => l !== me) : undefined;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPick(r.id)}
                  data-testid="chat-room"
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50", activeId === r.id && "bg-sky-50")}
                >
                  {r.kind === "channel" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-atlas-navy)] text-white">
                      <Hash className="h-4 w-4" />
                    </span>
                  ) : r.kind === "group" ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600">
                      <Users className="h-4 w-4" />
                    </span>
                  ) : (
                    <Avatar name={title} seed={other || r.id} size={36} online={isOnline(presence[other ?? ""])} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-extrabold" : "font-semibold")}>{title}</span>
                      {r.lastMessageAt ? <span className="shrink-0 text-[10px] text-slate-400">{timeLabel(r.lastMessageAt)}</span> : null}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={cn("min-w-0 flex-1 truncate text-xs", unread ? "font-semibold text-slate-800" : "text-slate-500")}>
                        {r.lastMessageText ? (r.lastMessageBy === me ? "You: " : r.kind === "dm" ? "" : "") + r.lastMessageText : "No messages yet"}
                      </span>
                      {unread && (!muted || mentioned) ? (
                        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-white", mentioned ? "bg-[var(--color-atlas-error)]" : "bg-sky-600")}>{mentioned ? "@" : "new"}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
