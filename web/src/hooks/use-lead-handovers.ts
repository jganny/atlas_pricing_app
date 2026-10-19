"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLiveData } from "@/lib/api";
import { fetchAuditLog } from "@/lib/firebase/audit-log";
import { handoversFrom, unseenHandovers, type HandoverEntry } from "@/lib/sales/visit-flow";

const SEEN_KEY = "atlas_handovers_seen_v1";
const SEEN_EVENT = "atlas-handovers-seen";

/** For administrators: leads that sales people handed to someone else, and how many they haven't looked at yet. */
export function useLeadHandovers(enabled: boolean) {
  const live = enabled && useLiveData;
  const { data = [] } = useQuery<HandoverEntry[]>({
    queryKey: ["lead-handovers"],
    queryFn: async () => handoversFrom(await fetchAuditLog(400)),
    enabled: live,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const [seenAt, setSeenAt] = useState("");
  // Re-read whenever any part of the app marks them seen (the menu count and the list share this).
  useEffect(() => {
    const read = () => {
      try {
        setSeenAt(localStorage.getItem(SEEN_KEY) || "");
      } catch {
        /* private mode: everything counts as new */
      }
    };
    read();
    window.addEventListener(SEEN_EVENT, read);
    return () => window.removeEventListener(SEEN_EVENT, read);
  }, []);
  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, now);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, []);
  return { entries: data, unseen: unseenHandovers(data, seenAt), seenAt, markSeen };
}
