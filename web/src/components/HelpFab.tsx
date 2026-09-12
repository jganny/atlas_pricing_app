"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Inbox,
  PlaneTakeoff,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { VertexAskBar } from "@/components/VertexAskBar";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { cn } from "@/lib/utils";

export function HelpFab() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: rows = [] } = useEnquiries();

  const overdue = useMemo(
    () => rows.filter((e) => e.slaHoursOpen > 8).length,
    [rows],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panel =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[210] flex justify-end" data-testid="help-panel">
            <button
              type="button"
              className="atlas-overlay absolute inset-0"
              aria-label="Close Vertex"
              data-modal-close
              onClick={() => setOpen(false)}
            />
            <aside
              className="atlas-glass relative z-10 flex h-full w-full max-w-md flex-col shadow-2xl animate-[atlas-slide-in_0.22s_ease-out]"
              role="dialog"
              aria-modal="true"
              aria-label="Vertex assistant"
            >
              <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
                <div>
                  <div className="text-sm font-extrabold tracking-wide text-[var(--color-atlas-navy)]">
                    Vertex
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Tell me the customer or lane — I will open it. ⌘?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 hover:bg-slate-100"
                  data-modal-close
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <VertexAskBar compact onNavigate={() => setOpen(false)} />

                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    I can do this now
                  </div>
                  <div className="grid gap-2">
                    {overdue > 0 ? (
                      <Link
                        href="/enquiries"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-950"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {overdue} quote{overdue === 1 ? "" : "s"} past SLA — open Enquiry DB
                      </Link>
                    ) : null}
                    <Link
                      href="/enquiries"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/80 px-3 py-2.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:border-[var(--color-atlas-gold)]"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Find any quote by customer or city
                    </Link>
                    <Link
                      href="/air"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/80 px-3 py-2.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:border-[var(--color-atlas-gold)]"
                    >
                      <PlaneTakeoff className="h-3.5 w-3.5" />
                      Start an air quote
                    </Link>
                    <Link
                      href="/inbox"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/80 px-3 py-2.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:border-[var(--color-atlas-gold)]"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      Quote from inbox mail
                    </Link>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  Vertex watches what you type and jumps: find quotes, open the right desk, or
                  flag overdue work. You should not need to remember a file name.
                </p>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        aria-label="Ask Vertex"
        data-testid="help-fab"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-4 z-[220] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white shadow-[0_12px_28px_rgba(28,24,79,0.32)] transition hover:scale-[1.03] hover:bg-[var(--color-atlas-ink)] md:bottom-5 md:right-5",
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {panel}
    </>
  );
}
