"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, SkipForward } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  NEXT_WHEN_CHOICES,
  hasAnyAnswer,
  optionAnswer,
  plusDays,
  reportSummary,
  type VisitAnswers,
  type VisitHistory,
  type VisitOption,
  type VisitQuestion,
} from "@/lib/sales/visit-report";
import { formatDay } from "@/lib/sales/activity-log";

type Draft = { picked: string[]; text: string; when: string };
const EMPTY: Draft = { picked: [], text: "", when: "" };

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function answerText(q: VisitQuestion, a: VisitAnswers): string | null | undefined {
  const v = a[q.id];
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (q.id === "next") {
    const n = v as NonNullable<VisitAnswers["next"]>;
    return `${n.what}${n.when ? ` · by ${formatDay(n.when)}` : ""}`;
  }
  if (Array.isArray(v)) return [...v, ...(q.detail && a.scopeNote ? [`“${a.scopeNote}”`] : [])].join(", ") || null;
  return String(v);
}

/**
 * The visit report as a short conversation: one question at a time, answered with taps (typing and the microphone always work),
 * every question can be skipped, and any answer can be changed afterwards. Saving is the caller's job (onSave).
 */
export function VisitChat({
  company,
  history,
  questions,
  busy,
  onSave,
  onCancel,
}: {
  company: string;
  history: VisitHistory;
  questions: VisitQuestion[];
  busy: boolean;
  onSave: (answers: VisitAnswers) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<VisitAnswers>({});
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const canSpeak = useMemo(() => speechCtor() !== null, []);
  const done = step >= questions.length;
  const q = !done ? questions[step] : undefined;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [step, answers]);
  useEffect(() => () => recRef.current?.stop(), []);

  /** Open question `i`, filled with the earlier answer when there is one. */
  function open(i: number, from: VisitAnswers = answers) {
    const qq = questions[i];
    const prev = qq ? from[qq.id] : undefined;
    let next = EMPTY;
    if (qq && prev) {
      if (qq.type === "next") next = { picked: [(prev as NonNullable<VisitAnswers["next"]>).what], text: "", when: (prev as NonNullable<VisitAnswers["next"]>).when };
      else if (Array.isArray(prev)) next = { picked: prev, text: qq.detail ? from.scopeNote ?? "" : "", when: "" };
      else next = { picked: [String(prev)], text: "", when: "" };
    }
    setDraft(next);
    setStep(i);
  }

  function ready(qq: VisitQuestion): boolean {
    const typed = draft.text.trim().length > 0;
    if (qq.type === "text") return typed;
    if (qq.type === "single") return draft.picked.length > 0 || typed;
    if (qq.type === "multi") return draft.picked.length > 0 || (!qq.detail && typed);
    if (qq.type === "next") return (draft.picked.length > 0 || typed) && !!draft.when;
    return true;
  }

  function commit(skip: boolean) {
    if (!q) return;
    const typed = draft.text.trim();
    const a: VisitAnswers = { ...answers };
    if (skip) {
      (a as Record<string, unknown>)[q.id] = null;
      if (q.detail) delete a.scopeNote;
    } else if (q.type === "text") a.who = typed;
    else if (q.type === "single") (a as Record<string, unknown>)[q.id] = typed || draft.picked[0];
    else if (q.type === "multi") {
      const picked = [...draft.picked];
      if (q.detail) {
        if (typed) a.scopeNote = typed;
        else delete a.scopeNote;
      } else if (typed) picked.push(typed);
      (a as Record<string, unknown>)[q.id] = picked;
    } else if (q.type === "next") a.next = { what: typed || draft.picked[0], when: draft.when };
    setAnswers(a);
    if (editing !== null) {
      setEditing(null);
      setStep(questions.length);
      setDraft(EMPTY);
      return;
    }
    open(step + 1, a);
  }

  function toggle(label: string) {
    if (!q) return;
    if (q.type === "single" || q.type === "next") setDraft((d) => ({ ...d, picked: [label], text: q.type === "single" ? "" : d.text }));
    else setDraft((d) => ({ ...d, picked: d.picked.includes(label) ? d.picked.filter((x) => x !== label) : [...d.picked, label] }));
  }

  function mic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>).map((r) => r[0]?.transcript ?? "").join(" ").trim();
      if (said) setDraft((d) => ({ ...d, text: d.text ? `${d.text} ${said}` : said }));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const groups = useMemo(() => {
    if (!q?.grouped) return null;
    const order: string[] = [];
    for (const o of q.options) if (o.group && !order.includes(o.group)) order.push(o.group);
    return order.map((g) => ({ group: g, options: q.options.filter((o) => o.group === g) }));
  }, [q]);

  function chip(o: VisitOption) {
    const label = q?.grouped ? optionAnswer(o) : o.label;
    const on = draft.picked.includes(label);
    return (
      <button
        key={`${o.group ?? ""}:${o.label}`}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(label)}
        className={cn(
          "min-h-10 rounded-xl border-[1.5px] px-3 py-1.5 text-sm transition",
          on ? "border-[var(--color-atlas-navy)] bg-sky-50 font-semibold text-[var(--color-atlas-navy)]" : "border-[var(--color-border)] bg-white hover:bg-slate-50",
        )}
      >
        {o.label}
      </button>
    );
  }

  const progress = Math.min(step, questions.length);
  const summary = reportSummary(history.kind, history.visitNo, answers);

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm" data-testid="visit-chat">
      <div className="flex items-center gap-3 bg-[var(--color-atlas-navy)] px-4 py-3 text-white">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 text-sm font-bold">
          {company.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{company}</div>
          <div className="text-xs opacity-80">
            {history.kind === "first" ? "First visit" : `Follow-up visit ${history.visitNo}`} · {questions.length} quick questions, skip any
          </div>
        </div>
        <button type="button" className="rounded-lg border border-white/40 px-2.5 py-1 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-2" aria-label="Progress">
        {questions.map((qq, i) => (
          <span key={qq.id} className={cn("h-1.5 flex-1 rounded-full", i < progress ? "bg-emerald-500" : i === progress && !done ? "bg-[var(--color-atlas-navy)]" : "bg-slate-200")} />
        ))}
        <span className="ml-2 whitespace-nowrap text-xs text-[var(--color-text-muted)]">{done ? "All done" : `${step + 1} of ${questions.length}`}</span>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto bg-slate-50 px-4 py-3" aria-live="polite">
        {history.lastPlan ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="last-plan">
            <b>Last visit, {formatDay(history.lastPlan.day)}.</b> You planned: {history.lastPlan.next}
            {history.lastPlan.by ? ` by ${formatDay(history.lastPlan.by)}` : ""}. Did it happen?
            <span className="ml-2 inline-flex gap-1.5">
              {(["yes", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={answers.lastPlanDone === v}
                  onClick={() => setAnswers((a) => ({ ...a, lastPlanDone: v }))}
                  className={cn("rounded-lg border px-2.5 py-0.5 text-xs font-semibold", answers.lastPlanDone === v ? "border-amber-700 bg-amber-200" : "border-amber-300 bg-white")}
                >
                  {v === "yes" ? "Done" : "Not yet"}
                </button>
              ))}
            </span>
          </div>
        ) : null}
        {questions.slice(0, done ? questions.length : step + 1).map((qq, i) => {
          const text = answerText(qq, answers);
          return (
            <div key={qq.id} className="space-y-1.5">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-[var(--color-border)] bg-white px-3 py-2 text-sm">{qq.ask}</div>
              {text !== undefined && i < (done ? questions.length : step) ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className={cn("max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-left text-sm", text === null ? "bg-slate-200 italic text-slate-600" : "bg-[var(--color-atlas-navy)] text-white")}
                    title="Tap to change"
                    onClick={() => {
                      setEditing(i);
                      open(i);
                    }}
                  >
                    {text === null ? "Skipped" : text}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        {q ? (
          <>
            <div className="text-base font-bold text-[var(--color-atlas-navy)]">{q.ask}</div>
            {q.hint ? <p className="mb-2 text-xs text-[var(--color-text-muted)]">{q.hint}</p> : null}
            {groups ? (
              groups.map((g) => (
                <div key={g.group} className="mb-1">
                  <div className="mb-1 mt-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--color-text-muted)]">{g.group}</div>
                  <div className="flex flex-wrap gap-2">{g.options.map(chip)}</div>
                </div>
              ))
            ) : q.type !== "text" ? (
              <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={q.name}>
                {q.options.map(chip)}
              </div>
            ) : null}
            {q.type === "next" ? (
              <>
                <div className="mb-1 mt-3 text-[11px] font-extrabold uppercase tracking-wide text-[var(--color-text-muted)]">By when?</div>
                <div className="flex flex-wrap gap-2">
                  {NEXT_WHEN_CHOICES.map((w) => {
                    const day = plusDays(w.days);
                    return (
                      <button
                        key={w.label}
                        type="button"
                        aria-pressed={draft.when === day}
                        onClick={() => setDraft((d) => ({ ...d, when: day }))}
                        className={cn("min-h-10 rounded-xl border-[1.5px] px-3 py-1.5 text-sm", draft.when === day ? "border-[var(--color-atlas-navy)] bg-sky-50 font-semibold text-[var(--color-atlas-navy)]" : "border-[var(--color-border)] bg-white hover:bg-slate-50")}
                      >
                        {w.label} · {formatDay(day)}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
            {q.type === "text" || q.allowOther || q.detail ? (
              <div className="mt-3 flex items-end gap-2">
                <Textarea
                  rows={q.type === "text" ? 1 : 2}
                  className="mt-0 flex-1"
                  aria-label={q.detail ? "Add detail, or type your own" : q.type === "text" ? q.name : "Something else? Type it"}
                  placeholder={q.placeholder ?? (q.detail ? "Add detail, or type your own" : "Something else? Type it")}
                  value={draft.text}
                  onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                />
                {canSpeak ? (
                  <button
                    type="button"
                    aria-label={listening ? "Stop listening" : "Speak your answer"}
                    aria-pressed={listening}
                    onClick={mic}
                    className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", listening ? "animate-pulse border-[var(--color-atlas-navy)] bg-[var(--color-atlas-navy)] text-white" : "border-[var(--color-border-strong)] bg-white")}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {step > 0 && editing === null ? (
                  <Button type="button" variant="secondary" className="h-9" onClick={() => open(step - 1)}>
                    Back
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" className="h-9 gap-1" onClick={() => commit(true)} data-testid="visit-skip">
                  <SkipForward className="h-3.5 w-3.5" /> Skip
                </Button>
              </div>
              <Button type="button" disabled={!ready(q)} onClick={() => commit(false)} data-testid="visit-next">
                {editing !== null ? "Save change" : step === questions.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm" data-testid="visit-summary">
              <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[var(--color-atlas-navy)]">Summary</span>
              {summary}
              {answers.next?.what ? (
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                  Next: <b>{answers.next.what}</b>
                  {answers.next.when ? ` by ${formatDay(answers.next.when)}. A reminder is set.` : "."}
                </span>
              ) : (
                <span className="mt-1 block text-xs text-[var(--color-text-muted)]">No next action, so no reminder will be set.</span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Tap any answer above to change it.</span>
              <Button type="button" disabled={busy || !hasAnyAnswer(answers)} onClick={() => onSave(answers)} data-testid="visit-save" className="gap-1.5">
                <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save visit"}
              </Button>
            </div>
            {!hasAnyAnswer(answers) ? <p className="mt-1 text-xs text-red-700">Every question was skipped. Answer at least one to save.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
