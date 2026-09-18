"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function PortalDropdown({
  open,
  anchorRef,
  children,
  maxHeight = 240,
  minWidth,
  backdrop = false,
  fitContent = false,
  onDismiss,
  testId,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  maxHeight?: number;
  minWidth?: number;
  backdrop?: boolean;
  /**
   * For action menus: measure the real content height and open on whichever
   * side (below, else above) shows every option without scrolling; only when
   * neither side fits does it use the roomier side and scroll. Autocomplete
   * lists leave this off and keep their "prefer below" behaviour.
   */
  fitContent?: boolean;
  onDismiss?: () => void;
  testId?: string;
}) {
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setContentH(null);
      return;
    }
    if (!fitContent || !panelRef.current) return;
    const h = panelRef.current.scrollHeight + 2;
    if (contentH !== h) setContentH(h);
  }, [open, box, fitContent, contentH, children]);

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
      // Only flip the dropdown above the field when there's genuinely too
      // little room below to show a useful list (roughly 2-3 rows) — not
      // simply whenever it's less than the full maxHeight. Comparing
      // against maxHeight meant a perfectly usable ~190px below (plenty
      // for several results) still flipped the dropdown all the way above
      // the field, sometimes far from it, on any page where the field
      // wasn't near the very top of the viewport.
      const minUsable = 140;
      let openUp = spaceBelow < minUsable && spaceAbove > spaceBelow;
      let height: number;
      if (fitContent) {
        const need = Math.min(maxHeight, contentH ?? maxHeight);
        if (spaceBelow >= need) {
          openUp = false;
          height = need;
        } else if (spaceAbove >= need) {
          openUp = true;
          height = need;
        } else {
          openUp = spaceAbove > spaceBelow;
          height = Math.max(120, openUp ? spaceAbove : spaceBelow);
        }
      } else {
        const available = Math.max(160, openUp ? spaceAbove : spaceBelow);
        height = Math.min(maxHeight, available);
      }
      const top = openUp ? Math.max(pad, r.top - height - 4) : Math.min(r.bottom + 4, window.innerHeight - height - pad);
      setBox({ top, left, width, height });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, maxHeight, minWidth, fitContent, contentH]);

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
        ref={panelRef}
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
