"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const REVEAL = 88;
const OPEN_AT = 40;

/**
 * iOS Mail / Outlook-style swipe-left to reveal Delete on the extreme right.
 * Desktop also shows Delete on hover or keyboard focus so a mouse is enough.
 */
export function SwipeDeleteRow({
  onDelete,
  deleteLabel = "Delete",
  children,
  className,
}: {
  onDelete: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const open = dx <= -OPEN_AT;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.buttons !== 1) return;
    startX.current = e.clientX;
    dragging.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 8) dragging.current = true;
    setDx(Math.min(0, Math.max(-REVEAL, delta)));
  }

  function onPointerUp() {
    if (startX.current == null) return;
    setDx((d) => (d < -OPEN_AT ? -REVEAL : 0));
    startX.current = null;
    window.setTimeout(() => {
      dragging.current = false;
    }, 40);
  }

  function handleDelete(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDx(0);
    onDelete();
  }

  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 z-0 flex w-[88px] items-center justify-center bg-red-600 text-[11px] font-extrabold uppercase tracking-wide text-white"
        onClick={handleDelete}
      >
        {deleteLabel}
      </button>
      <div
        className="relative z-10 bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (dragging.current || open) {
            e.preventDefault();
            e.stopPropagation();
            if (open && !dragging.current) setDx(0);
          }
        }}
      >
        {children}
        <button
          type="button"
          data-testid="swipe-delete"
          aria-label={deleteLabel}
          className={cn(
            "absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-md bg-red-600 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm",
            "opacity-0 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
            open ? "opacity-100" : "",
          )}
          onClick={handleDelete}
        >
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            {deleteLabel}
          </span>
        </button>
      </div>
    </div>
  );
}
