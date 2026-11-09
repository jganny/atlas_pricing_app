"use client";

import { useEffect } from "react";
import { toast } from "@/components/Toast";
import { subscribeMyCarrierReads } from "@/lib/firebase/carrier-board";
import { noticeFor } from "@/lib/carriers/read-notice";
import { useAuthStore } from "@/store/auth";

/**
 * Tells whoever uploaded a circular, the moment it happens and wherever they are in the app, that its automatic read has started,
 * finished, is waiting, or ran into a problem (with the reason). Draws nothing.
 */
export function CircularReadNotifier() {
  const username = useAuthStore((s) => s.user?.username);
  useEffect(() => {
    if (!username) return;
    return subscribeMyCarrierReads(username, (r) => {
      const n = noticeFor(r);
      toast(n.text, n.tone);
    });
  }, [username]);
  return null;
}
