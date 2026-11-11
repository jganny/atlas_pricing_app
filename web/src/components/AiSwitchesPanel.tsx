"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { AI_GROUPS, aiStatusText, type AiGroupId, type AiSwitches } from "@/lib/ai/ai-switches";
import { AI_SWITCHES_KEY, saveAiSwitches, useAiSwitches } from "@/lib/firebase/ai-switches";
import { cn } from "@/lib/utils";

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-atlas-navy)] disabled:opacity-50",
        on ? "bg-emerald-600" : "bg-slate-300",
      )}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Admin: switch AI on or off for everyone, or for one place it is used. Uses no AI credit itself. */
export function AiSwitchesPanel() {
  const qc = useQueryClient();
  const saved = useAiSwitches();
  const [draft, setDraft] = useState<AiSwitches | null>(null);
  const [busy, setBusy] = useState(false);
  const sw = draft ?? saved;
  const status = aiStatusText(sw);

  function setMaster(v: boolean) {
    setDraft({ ...sw, master: v });
  }
  function setGroup(id: AiGroupId, v: boolean) {
    setDraft({ ...sw, groups: { ...sw.groups, [id]: v } });
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await saveAiSwitches(draft);
      qc.setQueryData(AI_SWITCHES_KEY, draft);
      setDraft(null);
      toast("Saved. It takes effect for everyone within a minute.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 border-t border-[var(--color-border)] pt-5" data-testid="ai-switches-panel" aria-labelledby="ai-switches-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="ai-switches-h" className="flex items-center gap-2 text-sm font-bold text-[var(--color-atlas-navy)]">
            <Power className="h-4 w-4" aria-hidden /> AI switches
          </h3>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Turn AI off for everyone, or for one place only. When a switch is off, the button says so in plain words and the work is done by hand. Nothing is lost. Free features (no AI credit) are never affected.
          </p>
        </div>
        <span
          data-testid="ai-switches-status"
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            status.tone === "on" && "bg-emerald-50 text-emerald-800",
            status.tone === "partial" && "bg-amber-50 text-amber-800",
            status.tone === "off" && "bg-red-50 text-red-800",
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-atlas-navy)]">All AI</p>
          <p className="text-xs text-slate-500">The master switch. Off stops every AI feature below, whatever its own switch says.</p>
        </div>
        <Toggle on={sw.master} onChange={setMaster} label="All AI" disabled={busy} />
      </div>

      <ul className="mt-2 divide-y divide-[var(--color-border)]" data-testid="ai-switches-list">
        {AI_GROUPS.map((g) => (
          <li key={g.id} className={cn("flex items-start justify-between gap-4 py-3", !sw.master && "opacity-50")}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-atlas-navy)]">{g.name}</p>
              <p className="text-xs text-slate-600">{g.where}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {g.cost} · {g.who}
              </p>
            </div>
            <Toggle on={sw.groups[g.id] !== false} onChange={(v) => setGroup(g.id, v)} label={g.name} disabled={busy || !sw.master} />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={!draft || busy} data-testid="ai-switches-save">
          {busy ? "Saving…" : "Save switches"}
        </Button>
        {draft ? (
          <button type="button" className="text-xs font-semibold text-slate-500 underline" onClick={() => setDraft(null)}>
            Undo changes
          </button>
        ) : null}
      </div>
    </section>
  );
}
