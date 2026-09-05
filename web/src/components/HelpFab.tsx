"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen,
  HelpCircle,
  Inbox,
  Keyboard,
  PlaneTakeoff,
  Ship,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

const FAQ = [
  {
    q: "How do I quote from an email?",
    a: "Open Enquiry inbox or paste the mail body on Air/Sea desk Smart Quote strip, then tap Air or Sea.",
  },
  {
    q: "Where are Circulars tariffs?",
    a: "Circulars library — browse published air/sea tariffs or upload Excel to publish.",
  },
  {
    q: "How do I amend a locked quote?",
    a: "From Enquiry DB inspector request an amendment; admins approve on the Dashboard queue (2-hour unlock).",
  },
  {
    q: "Transport / Warehouse?",
    a: "Use the Transport and Warehouse desks in the sidebar — ⌘S saves like other desks.",
  },
];

const QUICK_LINKS = [
  { href: "/inbox", label: "Enquiry inbox", icon: Inbox },
  { href: "/air", label: "Air desk", icon: PlaneTakeoff },
  { href: "/sea", label: "Sea desk", icon: Ship },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function HelpFab() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function ask() {
    const p = prompt.toLowerCase();
    const hit = FAQ.find(
      (f) =>
        f.q.toLowerCase().includes(p) ||
        f.a.toLowerCase().includes(p) ||
        p.split(/\s+/).some((w) => w.length > 3 && (f.q + f.a).toLowerCase().includes(w)),
    );
    setAnswer(
      hit
        ? hit.a
        : "Try: paste enquiry on Air/Sea, ⌘K to jump, Enquiry DB for lifecycle, Circulars for rates. Legacy app is still linked from the header for anything not migrated.",
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Atlas Help"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[120] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white shadow-[0_12px_28px_rgba(11,31,58,0.35)] transition hover:scale-[1.03] hover:bg-[#14154a]"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[130] flex justify-end">
          <button
            type="button"
            className="atlas-overlay absolute inset-0"
            aria-label="Close Atlas Help"
            onClick={() => setOpen(false)}
          />
          <aside
            className="atlas-glass relative z-10 flex h-full w-full max-w-md flex-col animate-[atlas-slide-in_0.22s_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-label="Atlas Help"
          >
            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <div className="text-sm font-extrabold tracking-wide text-[var(--color-atlas-navy)]">
                  Atlas Help
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  Shortcuts, FAQ, and quick jumps — ⌘?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <Keyboard className="h-3 w-3" />
                  Shortcuts
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["⌘K", "Command palette"],
                    ["⌘?", "Toggle help"],
                    ["⌘S", "Save on desks"],
                    ["Esc", "Close overlays"],
                  ].map(([k, label]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white/70 px-2.5 py-2"
                    >
                      <span className="text-[var(--color-text-muted)]">{label}</span>
                      <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold">
                        {k}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Jump to
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/80 px-3 py-2.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:border-sky-300 hover:bg-sky-50/60"
                    >
                      <l.icon className="h-3.5 w-3.5" />
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Common questions
                </div>
                <ul className="space-y-2">
                  {FAQ.map((f) => (
                    <li key={f.q}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-white/70 px-3 py-2.5 text-left text-xs font-semibold hover:bg-slate-50"
                        onClick={() => {
                          setPrompt(f.q);
                          setAnswer(f.a);
                        }}
                      >
                        {f.q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Ask Atlas
                </div>
                <div className="flex gap-2">
                  <Input
                    className="mt-0"
                    placeholder="Ask about desks, inbox, amendments…"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") ask();
                    }}
                  />
                  <Button type="button" onClick={ask}>
                    Ask
                  </Button>
                </div>
                {answer ? (
                  <p
                    className={cn(
                      "mt-2 rounded-lg border border-sky-100 bg-sky-50/90 px-3 py-2.5 text-xs leading-relaxed text-sky-950",
                    )}
                  >
                    {answer}
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
