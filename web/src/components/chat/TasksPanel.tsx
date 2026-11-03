"use client";

import { useState } from "react";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useTeamChat } from "./ChatProvider";
import { cn } from "@/lib/utils";
import { deadlineLabel } from "@/lib/chat/work";

/** My tasks and reminders. Private: nobody else can see or change them. Tap one that came from a message to go back to it. */
export function TasksPanel({ onOpenChat }: { onOpenChat?: (roomId: string) => void }) {
  const chat = useTeamChat();
  const [text, setText] = useState("");
  const now = Date.now();
  const add = () => {
    if (!text.trim()) return;
    chat.addTask(text);
    setText("");
  };
  return (
    <div className="flex h-full flex-col" data-testid="tasks-panel">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-base font-extrabold text-[var(--color-atlas-navy)]">My tasks</h1>
        <p className="text-xs text-[var(--color-text-muted)]">Only you can see these. Make one from any message, or type /task in a chat.</p>
      </header>
      <div className="flex gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <input
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a task"
          aria-label="Add a task"
          data-testid="task-add-input"
          className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <button type="button" aria-label="Add task" onClick={add} disabled={!text.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white disabled:opacity-40">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-[var(--color-border)] overflow-y-auto">
        {chat.tasks.map((t) => {
          const late = t.dueMs !== undefined && t.dueMs < now;
          return (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2.5" data-testid="task-row">
              <button type="button" aria-label={`Mark done: ${t.text}`} onClick={() => chat.setTaskDone(t.id, true)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-600">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                disabled={!t.roomId || !onOpenChat}
                onClick={() => t.roomId && onOpenChat?.(t.roomId)}
              >
                <span className="block truncate text-sm font-semibold">{t.text}</span>
                <span className={cn("block text-[11px]", late ? "font-bold text-red-600" : "text-[var(--color-text-muted)]")}>
                  {t.dueMs !== undefined ? `${late ? "Late · " : "Due "}${deadlineLabel(t.dueMs, now)}` : "No time set"}
                  {t.roomId ? " · from a chat" : ""}
                </span>
              </button>
              {t.roomId && onOpenChat ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> : null}
              <button type="button" aria-label={`Delete: ${t.text}`} onClick={() => chat.removeTask(t.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
        {chat.tasks.length === 0 ? <li className="px-4 py-10 text-center text-sm text-slate-500">Nothing to do. Nice.</li> : null}
      </ul>
    </div>
  );
}
