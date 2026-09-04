"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
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
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        className="fixed bottom-5 right-5 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white shadow-lg hover:bg-[#14154a]"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed bottom-20 right-5 z-[100] w-[min(100vw-2rem,22rem)] rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Atlas Help</div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {FAQ.map((f) => (
              <li key={f.q}>
                <button
                  type="button"
                  className="w-full rounded-lg bg-slate-50 px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100"
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
          <div className="mt-3 flex gap-2">
            <Input
              className="mt-0"
              placeholder="Ask…"
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
            <p className={cn("mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-xs text-sky-950")}>
              {answer}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
