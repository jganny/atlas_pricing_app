"use client";

import { useEffect, useMemo, useState } from "react";
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

function loadState(): PipState {
  if (typeof window === "undefined") {
    return { open: false, minimized: false, x: 24, y: 120 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: false, minimized: false, x: 24, y: 120 };
    return { ...JSON.parse(raw), open: false } as PipState;
  } catch {
    return { open: false, minimized: false, x: 24, y: 120 };
  }
}

export function PremiumPipToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="hidden text-[var(--color-text-muted)] sm:inline-flex"
      onClick={onOpen}
      title="Open floating work panel (PiP)"
    >
      <PanelRight className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">Focus</span>
    </Button>
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
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 120 });
  const [dragging, setDragging] = useState<{ ox: number; oy: number } | null>(null);

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
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 320, e.clientX - dragging.ox)),
        y: Math.max(56, Math.min(window.innerHeight - 80, e.clientY - dragging.oy)),
      });
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
    if (pathname.startsWith("/quotes")) return "Quotes context";
    if (pathname.startsWith("/shipments")) return "Shipments context";
    if (pathname.startsWith("/air")) return "Air desk";
    if (pathname.startsWith("/sea")) return "Sea desk";
    return "Workspace context";
  }, [pathname]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[0_18px_50px_rgba(11,31,58,0.22)]",
        minimized ? "h-11 w-72" : "h-[min(420px,55vh)] w-[min(380px,92vw)]",
      )}
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label={title}
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
    </div>
  );
}
