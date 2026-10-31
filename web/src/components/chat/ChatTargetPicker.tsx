"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Avatar } from "./Avatar";
import { useTeamChat } from "./ChatProvider";
import { roomTitle } from "@/lib/chat/chat-logic";
import type { ChatRoom } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

/**
 * "Send this to…": lists the conversations you are in (desk channels, groups, direct chats), with a search box, and lets you
 * tick one or several. Used by Forward in Team Chat and by Share → Team Chat on a quote.
 */
export function ChatTargetPicker({
  title,
  hint,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  hint?: string;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (rooms: ChatRoom[]) => void;
}) {
  const chat = useTeamChat();
  const me = chat.me?.login ?? "";
  const [needle, setNeedle] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const rooms = useMemo(() => {
    const q = needle.trim().toLowerCase();
    return [...chat.rooms]
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
      .filter((r) => !q || roomTitle(r, me, chat.people).toLowerCase().includes(q));
  }, [chat.rooms, chat.people, me, needle]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosen = chat.rooms.filter((r) => picked.has(r.id));

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" role="dialog" aria-label={title} data-testid="chat-target-picker">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">{title}</h2>
            {hint ? <p className="text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="relative mb-2 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Search a person, group or desk"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-[var(--color-border)] py-2 pl-8 pr-3 text-sm"
          />
        </label>
        <ul className="min-h-[8rem] flex-1 space-y-0.5 overflow-y-auto">
          {rooms.map((r) => {
            const on = picked.has(r.id);
            const other = r.kind === "dm" ? r.memberLogins.find((l) => l !== me) : undefined;
            const name = roomTitle(r, me, chat.people);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={on}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm", on ? "bg-sky-50 ring-1 ring-sky-300" : "hover:bg-slate-50")}
                >
                  <input type="checkbox" readOnly checked={on} tabIndex={-1} aria-hidden className="pointer-events-none" />
                  <Avatar name={name} seed={other ?? r.id} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{name}</span>
                    <span className="block text-[11px] text-[var(--color-text-muted)]">
                      {r.kind === "dm" ? (other ? "Direct message" : "Notes to self") : r.kind === "group" ? "Group" : "Desk channel"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {rooms.length === 0 ? <li className="px-2 py-6 text-center text-sm text-[var(--color-text-muted)]">No conversation matches.</li> : null}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">{chosen.length ? `${chosen.length} selected` : "Pick one or more"}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!chosen.length || busy} onClick={() => onConfirm(chosen)}>
              {busy ? "Sending…" : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
