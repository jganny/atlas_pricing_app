"use client";

import { useEffect } from "react";
import { useLiveData } from "@/lib/api";
import { personDisplayName } from "@/lib/auth/desk-seats";
import { activityClock, heartbeat, startSession } from "@/lib/firebase/session-log";
import { HEARTBEAT_MS, TICK_MS } from "@/lib/session/session-log";
import { useAuthStore } from "@/store/auth";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Invisible. Records that this person signed in and, while they really use the app, how much. A click, key press,
 * scroll or touch counts; moving the mouse alone does not. Nothing is shown to the person and nothing they type is kept.
 */
export function SessionTracker() {
  const username = useAuthStore((s) => s.user?.username);
  const displayName = useAuthStore((s) => s.user?.displayName);

  useEffect(() => {
    if (!useLiveData || !username) return;
    const login = username.toLowerCase();
    let cancelled = false;
    const onUse = () => activityClock()?.interaction();
    EVENTS.forEach((e) => window.addEventListener(e, onUse, { capture: true, passive: true }));

    void startSession(login, personDisplayName(login, displayName)).catch((e) => console.warn("session start:", e instanceof Error ? e.message : e));
    const tick = window.setInterval(() => activityClock()?.tick(Date.now(), document.visibilityState === "visible" && document.hasFocus()), TICK_MS);
    const beat = window.setInterval(() => {
      if (!cancelled) void heartbeat();
    }, HEARTBEAT_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void heartbeat();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      EVENTS.forEach((e) => window.removeEventListener(e, onUse, { capture: true }));
      window.clearInterval(tick);
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [username, displayName]);

  return null;
}
