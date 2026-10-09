"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { clearHubPrefill, peekHubPrefill, type HubDeskPrefill } from "@/lib/hub/prefill";

/** Courier / Transport / Warehouse: fills the desk once from the Quote Hub job that was just opened. */
export function useHubPrefill(mode: HubDeskPrefill["mode"], apply: (p: HubDeskPrefill) => void) {
  const flag = useSearchParams()?.get("hub");
  useEffect(() => {
    if (!flag) return;
    const p = peekHubPrefill(mode);
    if (!p) return;
    apply(p);
    clearHubPrefill(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
}
