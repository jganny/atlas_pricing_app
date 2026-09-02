"use client";

import { useEffect } from "react";

/** Premium keyboard flow — ⌘S / Ctrl+S to save on desks (Microsoft/SAP pattern). */
export function useDeskSaveShortcut(onSave: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, enabled]);
}
