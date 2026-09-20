"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useLiveData } from "@/lib/api";
import { appVersion } from "@/lib/env";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useAuthStore } from "@/store/auth";
import {
  cleanMessage,
  cleanStack,
  clipText,
  createLimiter,
  fingerprintOf,
  isIgnorableError,
  isStaleAssetError,
  type LimiterStore,
} from "./error-fingerprint";

const sessionStore: LimiterStore = {
  get(k) {
    try {
      return sessionStorage.getItem(`atlas_err_${k}`);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      sessionStorage.setItem(`atlas_err_${k}`, v);
    } catch {
      /* private mode — fall back to no persistence */
    }
  },
};
const allow = createLimiter(sessionStore);

export interface ErrorReportInput {
  message: unknown;
  stack?: unknown;
  source: "window" | "promise" | "boundary";
  componentStack?: string;
}

/**
 * Records an error for the admin "Error monitor". Fire-and-forget and heavily
 * guarded: ignorable noise is dropped, the same error is sent at most once per
 * 10 minutes per tab and 15 times per session, and it can never throw. Only
 * signed-in users can write (firestore.rules) — sign-in-screen errors are not captured.
 * Returns the error's short reference code so the UI can show it to the user.
 */
export function reportError(input: ErrorReportInput): string | null {
  try {
    const message = cleanMessage(input.message);
    const stack = cleanStack(input.stack);
    if (isIgnorableError(message, stack)) return null;
    const fingerprint = fingerprintOf(message, stack);
    if (!allow(fingerprint)) return fingerprint;
    const user = useAuthStore.getState().user;
    if (!useLiveData || !user?.username) return fingerprint;
    void addDoc(collection(getFirebaseDb(), "clientErrors"), {
      at: serverTimestamp(),
      atIso: new Date().toISOString(),
      actor: user.username.toLowerCase(),
      fingerprint,
      message,
      stack,
      componentStack: clipText(input.componentStack, 1500),
      source: input.source,
      path: typeof location === "undefined" ? "" : location.pathname,
      version: appVersion,
      userAgent: clipText(typeof navigator === "undefined" ? "" : navigator.userAgent, 160),
    }).catch((e: unknown) => console.warn("error report not saved:", e instanceof Error ? e.message : e));
    return fingerprint;
  } catch {
    return null;
  }
}

/**
 * A tab opened before a release asking for files that no longer exist. One
 * automatic reload cures it; a per-session flag prevents reload loops.
 * Returns true when a reload was triggered.
 */
export function reloadOnceIfStale(message: string): boolean {
  try {
    if (!isStaleAssetError(message)) return false;
    if (sessionStorage.getItem("atlas_stale_reload")) return false;
    sessionStorage.setItem("atlas_stale_reload", "1");
    location.reload();
    return true;
  } catch {
    return false;
  }
}
