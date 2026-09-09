"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const REVEAL = 88;
const OPEN_AT = 40;

/**
 * Mail / Outlook swipe-left: the row slides to reveal Delete on the right.
 * Delete is never painted on top of the row (that covered status text like "won").
 * Fine-pointer hover peeks a sliver of Delete so desktop users can discover the gesture.
 */
export function SwipeDeleteRow({
  onDelete,
  deleteLabel = "Delete",
  children,
  className,
  revealed = false,
}: {
  onDelete: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
  className?: string;
  /** Keyboard equivalent of swipe-left (Shift+← in Ask Vertex). */
  revealed?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);
  const slide = revealed ? -REVEAL : dx;
  const open = slide <= -OPEN_AT;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-testid=swipe-delete]")) return;
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
        data-testid="swipe-delete"
        tabIndex={-1}
        aria-hidden={!open}
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 z-0 flex w-[88px] items-center justify-center bg-red-600 text-[11px] font-extrabold uppercase tracking-wide text-white"
        onClick={handleDelete}
      >
        {deleteLabel}
      </button>
      <div
        className={cn(
          "relative z-10 bg-white transition-transform duration-150 ease-out",
          slide === 0 && "md:group-hover:-translate-x-2",
        )}
        style={slide !== 0 ? { transform: `translateX(${slide}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("[data-testid=swipe-delete]")) return;
          if (dragging.current || open) {
            e.preventDefault();
            e.stopPropagation();
            if (open && !dragging.current) setDx(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
