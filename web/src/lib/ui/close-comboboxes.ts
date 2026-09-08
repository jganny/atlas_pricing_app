"use client";

import { useEffect } from "react";

export const CLOSE_COMBOBOXES_EVENT = "atlas-close-comboboxes";

/** Close leftover portal/typeahead lists (must never appear on cargo numerics). */
export function closeAllComboboxes() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLOSE_COMBOBOXES_EVENT));
}

export function useCloseComboboxes(onClose: () => void) {
  useEffect(() => {
    window.addEventListener(CLOSE_COMBOBOXES_EVENT, onClose);
    return () => window.removeEventListener(CLOSE_COMBOBOXES_EVENT, onClose);
  }, [onClose]);
}
