"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/Toast";
import {
  NRS_CHANGED_EVENT,
  listNrsAlerts,
  listPendingNrsFollowUps,
} from "@/lib/quotes/nrs-alerts";

/**
 * For whoever sits in the NRS seat: tells them the moment an Air/Sea nomination
 * desk confirms a quote (a pop-up on whatever screen they're on) and returns
 * how many follow-ups are waiting, for the sidebar badge. Other users: no-op.
 */
export function useNrsLiveAlerts(active: boolean): number {
  const [pending, setPending] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!active) return;
    const unseenAlerts = () => listNrsAlerts().filter((a) => !a.dismissed);

    // What's already here when the page opens is summarised once per browser session,
    // not announced one by one.
    seen.current = new Set(unseenAlerts().map((a) => a.id));
    const waiting = seen.current.size;
    let showedSummary = false;
    try {
      showedSummary = sessionStorage.getItem("atlas_nrs_summary_shown") === "1";
      if (waiting > 0 && !showedSummary) {
        sessionStorage.setItem("atlas_nrs_summary_shown", "1");
        toast(`${waiting} confirmation${waiting > 1 ? "s" : ""} waiting for the NRS desk`, "info");
      }
    } catch {
      /* private mode — skip the summary */
    }

    const refresh = () => {
      setPending(listPendingNrsFollowUps().length);
      for (const a of unseenAlerts()) {
        if (seen.current?.has(a.id)) continue;
        seen.current?.add(a.id);
        toast(a.message, "info");
      }
    };
    refresh();
    window.addEventListener(NRS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(NRS_CHANGED_EVENT, refresh);
  }, [active]);

  return active ? pending : 0;
}
