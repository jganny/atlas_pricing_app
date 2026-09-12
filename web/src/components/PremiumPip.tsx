"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minimize2, Maximize2, X, GripVertical, PanelRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "atlas.premium.pip.v1";

type PipState = {
  open: boolean;
  minimized: boolean;
  x: number;
  y: number;
};

function clampPos(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(window.innerWidth - 320, x)),
    y: Math.max(56, Math.min(window.innerHeight - 80, y)),
  };
}

function loadState(): PipState {
  if (typeof window === "undefined") {
    return { open: false, minimized: false, x: 24, y: 120 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, minimized: false, x: 24, y: 120 };
    const parsed = JSON.parse(raw) as PipState;
    const pos = clampPos(parsed.x ?? 24, parsed.y ?? 120);
    return { open: false, minimized: !!parsed.minimized, ...pos };
  } catch {
    return { open: false, minimized: false, x: 24, y: 120 };
  }
}

export function PremiumPipToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-atlas-navy)]"
      onClick={onOpen}
      title="Open floating work panel (PiP)"
      aria-label="Focus"
      data-testid="focus-open"
    >
      <PanelRight className="h-3.5 w-3.5" />
    </button>
  );
}

export function PremiumPip({
  open,
  onOpenChange,
  children,
  title = "Focus panel",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname() ?? "/";
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 120 });
  const [dragging, setDragging] = useState<{ ox: number; oy: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const s = loadState();
    setMinimized(s.minimized);
    setPos({ x: s.x, y: s.y });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, minimized, x: pos.x, y: pos.y }));
  }, [open, minimized, pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      setPos(clampPos(e.clientX - dragging.ox, e.clientY - dragging.oy));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  const contextHint = useMemo(() => {
    if (pathname.startsWith("/inbox")) return "Inbox context";
    if (pathname.startsWith("/edb") || pathname.startsWith("/enquiries")) return "EDB context";
    if (pathname.startsWith("/air")) return "Air desk";
    if (pathname.startsWith("/sea")) return "Sea desk";
    return "Workspace context";
  }, [pathname]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed z-[180] flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[0_18px_50px_rgba(11,31,58,0.22)]",
        minimized ? "h-11 w-72" : "h-[min(420px,55vh)] w-[min(380px,92vw)]",
      )}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={title}
      data-testid="focus-pip"
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1.5 active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          setDragging({ ox: e.clientX - pos.x, oy: e.clientY - pos.y });
        }}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-[var(--color-atlas-navy)]">{title}</p>
          {!minimized ? (
            <p className="truncate text-[10px] text-[var(--color-text-muted)]">{contextHint}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setMinimized((v) => !v)}
          aria-label={minimized ? "Expand panel" : "Minimize panel"}
        >
          {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {!minimized ? <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">{children}</div> : null}
    </div>,
    document.body,
  );
}
