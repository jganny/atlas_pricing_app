"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function PortalDropdown({
  open,
  anchorRef,
  children,
  maxHeight = 240,
  minWidth,
  backdrop = false,
  onDismiss,
  testId,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  maxHeight?: number;
  minWidth?: number;
  backdrop?: boolean;
  onDismiss?: () => void;
  testId?: string;
}) {
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setBox(null);
      return;
    }
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 8;
      const width = Math.min(
        Math.max(r.width, minWidth ?? r.width),
        window.innerWidth - pad * 2,
      );
      let left = r.left;
      if (left + width > window.innerWidth - pad) left = window.innerWidth - width - pad;
      if (left < pad) left = pad;

      const spaceBelow = window.innerHeight - r.bottom - pad;
      const spaceAbove = r.top - pad;
      const openUp = spaceBelow < Math.min(maxHeight, 160) && spaceAbove > spaceBelow;
      const available = Math.max(120, openUp ? spaceAbove : spaceBelow);
      const height = Math.min(maxHeight, available);
      const top = openUp ? Math.max(pad, r.top - height - 4) : r.bottom + 4;
      setBox({ top, left, width, height });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, maxHeight, minWidth]);

  useEffect(() => {
    if (!open || !onDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open || !box || typeof document === "undefined") return null;

  return createPortal(
    <>
      {backdrop ? (
        <button
          type="button"
          aria-label="Close menu"
          data-testid={testId ? `${testId}-backdrop` : "portal-dropdown-backdrop"}
          className="fixed inset-0 z-[399] bg-slate-900/25"
          onClick={onDismiss}
        />
      ) : null}
      <div
        data-portal-dropdown
        data-testid={testId}
        className="z-[400] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-xl"
        style={{
          position: "fixed",
          top: box.top,
          left: box.left,
          width: box.width,
          maxHeight: box.height,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
