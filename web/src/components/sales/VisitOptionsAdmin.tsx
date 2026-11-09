"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { addOptionTo, moveOption, removeOptionAt } from "@/lib/sales/visit-options-edit";
import { applyConfig, type VisitQuestion, type VisitQuestionId, type VisitSuggestion } from "@/lib/sales/visit-report";
import { fetchVisitConfig, fetchVisitSuggestions, removeVisitSuggestion, saveVisitConfig } from "@/lib/firebase/visit-options";

/** Admin: edit every list of options in the visit report, and see what people typed under "something else". */
export function VisitOptionsAdmin() {
  const user = useAuthStore((s) => s.user);
  const [questions, setQuestions] = useState<VisitQuestion[] | null>(null);
  const [suggestions, setSuggestions] = useState<VisitSuggestion[]>([]);
  const [active, setActive] = useState<VisitQuestionId>("purpose");
  const [newLabel, setNewLabel] = useState("");
  const [newGroup, setNewGroup] = useState("Other services");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [cfg, sug] = await Promise.all([fetchVisitConfig(), fetchVisitSuggestions().catch(() => [])]);
      if (alive) {
        setQuestions(applyConfig(cfg));
        setSuggestions(sug);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!questions) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the visit report options…
      </p>
    );
  }
  const editable = questions.filter((q) => q.type !== "text");
  const q = editable.find((x) => x.id === active) ?? editable[0];
  const mine = suggestions.filter((s) => s.question === q.id);

  function change(next: VisitQuestion) {
    setQuestions((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await saveVisitConfig(questions ?? [], user?.username || "admin");
      setDirty(false);
      toast("Saved. Everyone sees the new options straight away.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The options could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  function add(label: string, group?: string) {
    const r = addOptionTo(q, label, q.grouped ? group : undefined);
    if (r.error) {
      toast(r.error, "error");
      return false;
    }
    change(r.question);
    return true;
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="visit-options-admin">
      <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Visit report options</h2>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        The tap-to-pick answers in a sales person&apos;s visit report. Rename, reorder, hide or delete any option, or add your own. Hidden options stay on old visits. Changes show for everyone once you save.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <ul className="space-y-1" aria-label="Questions">
          {editable.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-current={x.id === q.id}
                onClick={() => setActive(x.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${x.id === q.id ? "bg-sky-50 font-semibold text-[var(--color-atlas-navy)]" : "hover:bg-slate-50"}`}
              >
                <span>
                  {x.name}
                  <span className="block text-[11px] font-normal text-[var(--color-text-muted)]">{x.asked === "first" ? "First visit" : "First visit and follow-up"}</span>
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{x.options.filter((o) => !o.hidden).length}</span>
              </button>
            </li>
          ))}
        </ul>

        <div>
          <ul className="divide-y divide-[var(--color-border)]">
            {q.options.map((o, i) => (
              <li key={`${o.group ?? ""}:${i}`} className={`flex items-center gap-2 py-1.5 ${o.hidden ? "opacity-60" : ""}`}>
                {q.grouped ? <span className="w-24 shrink-0 text-[11px] font-bold uppercase text-[var(--color-text-muted)]">{o.group}</span> : null}
                <Input
                  className={`mt-0 flex-1 ${o.hidden ? "line-through" : ""}`}
                  value={o.label}
                  aria-label={`Option ${i + 1}`}
                  onChange={(e) => change({ ...q, options: q.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                />
                <button type="button" className="rounded-md border border-[var(--color-border)] p-1.5 disabled:opacity-30" aria-label="Move up" disabled={i === 0} onClick={() => change(moveOption(q, i, -1))}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded-md border border-[var(--color-border)] p-1.5 disabled:opacity-30" aria-label="Move down" disabled={i === q.options.length - 1} onClick={() => change(moveOption(q, i, 1))}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded-md border border-[var(--color-border)] p-1.5" aria-label={o.hidden ? "Show" : "Hide"} title={o.hidden ? "Show again" : "Hide from new visits"} onClick={() => change({ ...q, options: q.options.map((x, j) => (j === i ? { ...x, hidden: !x.hidden } : x)) })}>
                  {o.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" className="rounded-md border border-[var(--color-border)] p-1.5 text-red-700" aria-label="Delete" title="Delete (old visits keep it)" onClick={() => change(removeOptionAt(q, i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (add(newLabel, newGroup)) setNewLabel("");
            }}
          >
            {q.grouped ? (
              <Select className="mt-0 w-40" aria-label="Group for the new option" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
                {["Air", "Sea", "Other services"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            ) : null}
            <Input className="mt-0 min-w-[12rem] flex-1" aria-label="Add an option" placeholder="Add an option" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>

          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <input type="checkbox" checked={q.allowOther} onChange={(e) => change({ ...q, allowOther: e.target.checked })} />
            Let people type &ldquo;something else&rdquo; for this question
          </label>

          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-amber-800">People typed these under &ldquo;something else&rdquo;</h3>
            {mine.length === 0 ? (
              <p className="py-1 text-xs text-[var(--color-text-muted)]">Nothing typed yet for this question.</p>
            ) : (
              mine.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 border-t border-amber-200 py-1.5 text-sm first:border-t-0">
                  <span>
                    <b>{s.text}</b>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {s.count} time{s.count > 1 ? "s" : ""}
                      {s.by.length ? ` · ${s.by.join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button
                      type="button"
                      className="h-8"
                      onClick={async () => {
                        if (!add(s.text, "Other services")) return;
                        await removeVisitSuggestion(s.id).catch(() => undefined);
                        setSuggestions((p) => p.filter((x) => x.id !== s.id));
                      }}
                    >
                      Add to the list
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8"
                      onClick={async () => {
                        await removeVisitSuggestion(s.id).catch(() => undefined);
                        setSuggestions((p) => p.filter((x) => x.id !== s.id));
                      }}
                    >
                      Ignore
                    </Button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {dirty ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
        <Button type="button" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Saving…" : "Save options"}
        </Button>
      </div>
    </section>
  );
}
