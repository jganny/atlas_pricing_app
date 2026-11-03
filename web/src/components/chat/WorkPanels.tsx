"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { deadlineLabel, deadlinePresets } from "@/lib/chat/work";
import type { Person } from "@/lib/chat/types";

const chip = (on: boolean) => cn("rounded-full border px-2.5 py-1 text-xs font-semibold", on ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:bg-slate-50");

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="work-panel">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{title}</span>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded p-0.5 hover:bg-slate-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Deadlines({ value, onPick, allowNone }: { value?: number; onPick: (ms: number | undefined) => void; allowNone?: boolean }) {
  const now = Date.now();
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone ? (
        <button type="button" className={chip(value === undefined)} onClick={() => onPick(undefined)}>
          No time
        </button>
      ) : null}
      {deadlinePresets(now).map((p) => (
        <button key={p.label} type="button" className={chip(value === p.ms)} onClick={() => onPick(p.ms)} title={deadlineLabel(p.ms, now)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** "/approve": who may decide (nobody picked = anyone in the chat), and an optional reply-by time. */
export function ApprovePanel({
  people,
  approvers,
  replyBy,
  onChange,
  onClose,
}: {
  people: Person[];
  approvers: string[];
  replyBy?: number;
  onChange: (next: { approvers: string[]; replyBy?: number }) => void;
  onClose: () => void;
}) {
  const toggle = (login: string) => onChange({ approvers: approvers.includes(login) ? approvers.filter((l) => l !== login) : [...approvers, login], replyBy });
  return (
    <Shell title="Ask for a decision" onClose={onClose}>
      <p className="mb-1.5 text-xs text-slate-500">Who should decide? Pick none to let anyone in this chat decide.</p>
      <div className="mb-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {people.map((p) => (
          <button key={p.login} type="button" className={chip(approvers.includes(p.login))} onClick={() => toggle(p.login)} aria-pressed={approvers.includes(p.login)}>
            {p.name}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-xs text-slate-500">Reply by (optional)</p>
      <Deadlines value={replyBy} allowNone onPick={(ms) => onChange({ approvers, replyBy: ms })} />
      <p className="mt-2 text-[11px] text-slate-400">Now write what you need approved, and send.</p>
    </Shell>
  );
}

/** "/replyby": ask everyone in the chat to reply or tap "Got it" by a time. */
export function ReplyByPanel({ replyBy, onPick, onClose }: { replyBy?: number; onPick: (ms: number | undefined) => void; onClose: () => void }) {
  return (
    <Shell title="Ask for a reply by" onClose={onClose}>
      <Deadlines value={replyBy} onPick={onPick} />
      <p className="mt-2 text-[11px] text-slate-400">Now write your message and send. People see the time and can tap “Got it”.</p>
    </Shell>
  );
}

/** "/task" and "/remind": a note to yourself, with or without a time. Private to you. */
export function TaskPanel({
  kind,
  initialText,
  onSave,
  onClose,
}: {
  kind: "task" | "remind";
  initialText: string;
  onSave: (text: string, dueMs?: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [due, setDue] = useState<number | undefined>(() => (kind === "remind" ? deadlinePresets(Date.now())[0].ms : undefined));
  return (
    <Shell title={kind === "remind" ? "Remind me" : "New task (only you see it)"} onClose={onClose}>
      <input
        autoFocus
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) onSave(text, due);
        }}
        placeholder={kind === "remind" ? "What should I remind you about?" : "What needs doing?"}
        data-testid="task-text"
        className="mb-2 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
      />
      <Deadlines value={due} allowNone={kind === "task"} onPick={setDue} />
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" disabled={!text.trim() || (kind === "remind" && !due)} onClick={() => onSave(text, due)} data-testid="task-save">
          {kind === "remind" ? "Remind me" : "Add task"}
        </Button>
      </div>
    </Shell>
  );
}
