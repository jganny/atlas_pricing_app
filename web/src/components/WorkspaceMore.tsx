"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

/** Overflow for parallel-run tools — not daily header buttons. */
export function WorkspaceMore() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="workspace-more"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-atlas-navy)]"
        title="More"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="atlas-glass absolute right-0 z-[80] mt-1 w-48 overflow-hidden rounded-xl py-1 text-sm shadow-lg"
        >
          <Link
            role="menuitem"
            href="/motion"
            className="block px-3 py-2 font-semibold text-[var(--color-atlas-navy)] hover:bg-white/70"
            onClick={() => setOpen(false)}
          >
            Motion sample
          </Link>
          <a
            role="menuitem"
            href="/index.html"
            className="block px-3 py-2 font-semibold text-[var(--color-atlas-navy)] hover:bg-white/70"
            onClick={() => setOpen(false)}
          >
            Classic app
          </a>
          <p className="px-3 pb-2 pt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">
            Old homepage — only while both apps run.
          </p>
        </div>
      ) : null}
    </div>
  );
}
