"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftFingerprint,
  draftKey,
  readDraft,
  removeDraft,
  writeDraft,
  type DraftEnvelope,
} from "@/lib/ui/desk-draft";

const SETTLE_MS = 1500; // let the desk's own defaults load before treating the form as "untouched"
const SAVE_DELAY_MS = 700;

/**
 * Saves the quote being worked on, as it is typed, and offers it back after a power cut or crash.
 * `enabled` is false while editing a saved quote or opening a prefill — those have their own source.
 */
export function useDeskDraft<T extends object>(opts: {
  desk: string;
  username: string | undefined | null;
  enabled: boolean;
  state: T;
  apply: (state: T) => void;
  summarize: (state: T) => string;
  /** A form with nothing meaningful typed yet (no customer, no route…) is never kept as a draft. */
  hasContent: (state: T) => boolean;
}) {
  const { desk, username, enabled, state, apply, summarize, hasContent } = opts;
  const key = draftKey(desk, username);
  const [pending, setPending] = useState<DraftEnvelope<T> | null>(null);
  const baseline = useRef<string | null>(null);
  const clearedAt = useRef<string | null>(null);
  const latest = useRef({ state, summarize, hasContent });
  latest.current = { state, summarize, hasContent };
  const fingerprint = draftFingerprint(state);
  const paused = pending !== null;

  // On open: is there an unfinished quote from last time?
  useEffect(() => {
    if (!enabled || !username) return;
    const found = readDraft<T>(key);
    if (found) setPending(found);
    baseline.current = null;
    const t = window.setTimeout(() => {
      baseline.current = draftFingerprint(latest.current.state);
    }, SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [enabled, username, key]);

  const save = useCallback(() => {
    writeDraft<T>(key, {
      v: 1,
      savedAt: new Date().toISOString(),
      summary: latest.current.summarize(latest.current.state),
      state: latest.current.state,
    });
  }, [key]);

  // As the user works: save shortly after each change; an untouched form leaves no draft.
  useEffect(() => {
    if (!enabled || !username || paused || baseline.current === null) return;
    if (fingerprint === baseline.current || !latest.current.hasContent(latest.current.state)) {
      removeDraft(key);
      return;
    }
    if (fingerprint === clearedAt.current) return; // just saved/cleared — nothing new to protect
    const t = window.setTimeout(save, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [fingerprint, enabled, username, paused, key, save]);

  // Leaving the page / switching away: save at once rather than waiting out the delay.
  useEffect(() => {
    if (!enabled || !username) return;
    const flush = () => {
      if (paused || baseline.current === null) return;
      const fp = draftFingerprint(latest.current.state);
      if (fp !== baseline.current && fp !== clearedAt.current && latest.current.hasContent(latest.current.state)) save();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [enabled, username, paused, save]);

  const resume = useCallback(() => {
    if (!pending) return;
    apply(pending.state);
    setPending(null);
  }, [pending, apply]);

  const discard = useCallback(() => {
    removeDraft(key);
    setPending(null);
  }, [key]);

  /** The quote was saved (or the form cleared): forget the draft. */
  const clear = useCallback(() => {
    removeDraft(key);
    clearedAt.current = draftFingerprint(latest.current.state);
    setPending(null);
  }, [key]);

  return { pending, resume, discard, clear };
}
