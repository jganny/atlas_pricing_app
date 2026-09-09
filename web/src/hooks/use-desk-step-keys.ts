"use client";

import { useEffect } from "react";
import { focusById } from "@/lib/ui/desk-keyboard";

/**
 * Alt+1…9 jumps to desk step tabs. Same pattern on Courier, Transport, Warehouse, Air, Sea.
 */
export function useDeskStepKeys<T extends string>(opts: {
  steps: readonly T[];
  setStep: (step: T) => void;
  focusIds?: Partial<Record<T, string>>;
  enabled?: boolean;
}) {
  const { steps, setStep, focusIds, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof HTMLTextAreaElement && e.key.length === 1 && !/^\d$/.test(e.key)) {
        return;
      }
      if (!/^[1-9]$/.test(e.key)) return;
      const next = steps[Number(e.key) - 1];
      if (!next) return;
      e.preventDefault();
      setStep(next);
      focusById(focusIds?.[next]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, setStep, focusIds, enabled]);
}
