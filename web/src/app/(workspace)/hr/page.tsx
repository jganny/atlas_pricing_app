"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import { useAuthStore } from "@/store/auth";

const NOTES_KEY = "atlas_hr_notes";

export default function HrPage() {
  const user = useAuthStore((s) => s.user);
  const members = Object.entries(TEAM_ROLES).filter(([, r]) => r.type === "member");
  const [notes, setNotes] = useState("");
  const [leaveLog, setLeaveLog] = useState<string[]>([]);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") as {
        notes?: string;
        leave?: string[];
      };
      setNotes(all.notes || "");
      setLeaveLog(all.leave || []);
    } catch {
      /* ignore */
    }
  }, []);

  function saveNotes() {
    const prev = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
    localStorage.setItem(NOTES_KEY, JSON.stringify({ ...prev, notes, leave: leaveLog }));
    toast("HR notes saved", "success");
  }

  function addLeave() {
    const who = window.prompt("Desk username on leave?");
    if (!who?.trim()) return;
    const days = window.prompt("Days / note?", "1 day");
    const entry = `${new Date().toLocaleDateString()} · ${who.trim()} · ${days || "leave"}`;
    const next = [entry, ...leaveLog].slice(0, 40);
    setLeaveLog(next);
    const prev = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
    localStorage.setItem(NOTES_KEY, JSON.stringify({ ...prev, notes, leave: next }));
    toast("Leave logged", "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">HR / roster</h1>
        <Badge tone="info">Phase 13</Badge>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Desk roster, leave log, and notes — payroll stays out of scope. Signed in as{" "}
        {user?.username || "desk"}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map(([id, role]) => (
          <Card key={id}>
            <div className="font-bold text-[var(--color-atlas-navy)]">{role.name}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{id}</div>
            <div className="mt-2 text-sm">{role.category || "General"}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Desk notes</h2>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="button" className="mt-2" onClick={saveNotes}>
            Save notes
          </Button>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Leave log</h2>
            <Button type="button" variant="secondary" className="text-xs" onClick={addLeave}>
              Add leave
            </Button>
          </div>
          <ul className="max-h-48 space-y-1 overflow-auto text-sm">
            {leaveLog.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No leave entries yet.</li>
            ) : (
              leaveLog.map((l, i) => (
                <li key={i} className="rounded bg-slate-50 px-2 py-1">
                  {l}
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
