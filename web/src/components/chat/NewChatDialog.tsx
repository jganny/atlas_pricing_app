"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import { isOnline } from "@/lib/chat/chat-logic";
import type { Person, Presence } from "@/lib/chat/types";

/** Start a direct chat with one person, or a group with several. */
export function NewChatDialog({
  meLogin,
  people,
  presence,
  onClose,
  onDirect,
  onGroup,
}: {
  meLogin: string;
  people: Person[];
  presence: Record<string, Presence>;
  onClose: () => void;
  onDirect: (login: string) => void;
  onGroup: (name: string, logins: string[]) => void;
}) {
  const [mode, setMode] = useState<"dm" | "group">("dm");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const shown = useMemo(() => people.filter((p) => !q.trim() || `${p.name} ${p.desk ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [people, q]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="New chat">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">New chat</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-3">
          {(["dm", "group"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-lg px-3 py-1.5 text-sm font-bold", mode === m ? "bg-[var(--color-atlas-navy)] text-white" : "bg-slate-100 text-slate-600")}>
              {m === "dm" ? "Direct message" : "New group"}
            </button>
          ))}
        </div>
        {mode === "group" ? (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Reefer pricing" maxLength={60} className="mx-4 mt-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-atlas-navy)]" />
        ) : null}
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a colleague" className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus />
        </div>
        {mode === "dm" && !q.trim() ? (
          <button type="button" onClick={() => onDirect(meLogin)} className="mx-2 mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50" data-testid="chat-notes-to-self">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-amber-100 text-base">📝</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Notes to self</span>
              <span className="block text-xs text-slate-500">Keep reminders and files for yourself</span>
            </span>
          </button>
        ) : null}
        <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {shown.length === 0 ? <li className="px-4 py-6 text-center text-sm text-slate-500">Nobody found.</li> : null}
          {shown.map((p) => {
            const on = picked.includes(p.login);
            return (
              <li key={p.login}>
                <button
                  type="button"
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50", on && "bg-sky-50")}
                  onClick={() => (mode === "dm" ? onDirect(p.login) : setPicked((cur) => (on ? cur.filter((l) => l !== p.login) : [...cur, p.login])))}
                >
                  <Avatar name={p.name} seed={p.login} size={34} online={isOnline(presence[p.login])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p.name}</span>
                    {p.desk ? <span className="block truncate text-xs text-slate-500">{p.desk}</span> : null}
                  </span>
                  {mode === "group" && on ? <Check className="h-4 w-4 text-sky-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {mode === "group" ? (
          <div className="border-t border-slate-100 p-3">
            <Button className="w-full" disabled={picked.length === 0 || !name.trim()} onClick={() => onGroup(name, picked)}>
              Create group{picked.length ? ` with ${picked.length}` : ""}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
