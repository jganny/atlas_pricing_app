"use client";

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function PortalDropdown({
  open,
  anchorRef,
  children,
  maxHeight = 240,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  maxHeight?: number;
}) {
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setBox(null);
      return;
    }
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < Math.min(maxHeight, 160) && r.top > spaceBelow;
      setBox({
        top: openUp ? Math.max(8, r.top - maxHeight - 4) : r.bottom + 4,
        left: r.left,
        width: r.width,
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, maxHeight]);

  if (!open || !box || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-portal-dropdown
      className="z-[400] overflow-auto rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-xl"
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
