"use client";

import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { appVersion } from "@/lib/env";
import { ActivityClock, SESSION_REUSE_MS, type SessionRow } from "@/lib/session/session-log";
import { getFirebaseDb } from "./client";

const COLLECTION = "sessionLog";
const LOCAL_KEY = "atlas_session_v1";

interface LocalSession {
  id: string;
  login: string;
  startMs: number;
  lastBeat: number;
  /** What earlier tabs of this same session already recorded. */
  baseActiveSec: number;
  baseIdleMin: number;
  baseLongestIdle: number;
}

let clock: ActivityClock | null = null;
let local: LocalSession | null = null;

function readLocal(): LocalSession | null {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") as LocalSession | null;
  } catch {
    return null;
  }
}

function writeLocal(s: LocalSession | null) {
  try {
    if (s) localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* private mode — the session still records, it just can't be resumed by another tab */
  }
}

function browserLabel(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "Mac" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return `${br} on ${os}`;
}

/** The running clock for this tab — call `.interaction()` on use. */
export function activityClock(): ActivityClock | null {
  return clock;
}

/** Starts a session for this sign-in, or carries on the one from the last 30 minutes. */
export async function startSession(login: string, name: string): Promise<void> {
  const now = Date.now();
  const saved = readLocal();
  clock = new ActivityClock(now);
  if (saved && saved.login === login && now - saved.lastBeat < SESSION_REUSE_MS) {
    local = { ...saved, lastBeat: now };
    writeLocal(local);
    return;
  }
  const id = `${login}_${now.toString(36)}`;
  local = { id, login, startMs: now, lastBeat: now, baseActiveSec: 0, baseIdleMin: 0, baseLongestIdle: 0 };
  writeLocal(local);
  await setDoc(doc(getFirebaseDb(), COLLECTION, id), {
    login,
    name,
    startAt: serverTimestamp(),
    startMs: now,
    lastSeenAt: serverTimestamp(),
    lastSeenMs: now,
    activeSec: 0,
    idleMin: 0,
    longestIdleMin: 0,
    ua: browserLabel(),
    version: appVersion,
  });
}

/** Saves the running totals. Called every couple of minutes and when the tab is hidden. */
export async function heartbeat(end?: { reason: string }): Promise<void> {
  if (!local || !clock) return;
  const now = Date.now();
  const snap = clock.snapshot(now);
  const activeSec = local.baseActiveSec + snap.activeSec;
  const idleMin = local.baseIdleMin + snap.idleMin;
  const longestIdleMin = Math.max(local.baseLongestIdle, snap.longestIdleMin);
  local = { ...local, lastBeat: now };
  // Remember the running totals so a reload of this tab carries on from here. The clock itself keeps running
  // (it is never reset), so a long idle stretch keeps growing instead of being cut off at each save.
  if (!end) writeLocal({ ...local, baseActiveSec: activeSec, baseIdleMin: idleMin, baseLongestIdle: longestIdleMin });
  await updateDoc(doc(getFirebaseDb(), COLLECTION, local.id), {
    lastSeenAt: serverTimestamp(),
    lastSeenMs: now,
    activeSec,
    idleMin,
    longestIdleMin,
    ...(end ? { endMs: now, endReason: end.reason } : {}),
  }).catch((e: unknown) => console.warn("session log:", e instanceof Error ? e.message : e));
}

export async function endSession(reason = "signed_out"): Promise<void> {
  if (!local) local = readLocal();
  if (!local || !clock) {
    writeLocal(null);
    return;
  }
  try {
    await Promise.race([heartbeat({ reason }), new Promise((r) => setTimeout(r, 2500))]);
  } finally {
    writeLocal(null);
    local = null;
    clock = null;
  }
}

/** Admin: sessions that started on or after `fromMs`, newest first. */
export async function fetchSessions(fromMs: number, max = 3000): Promise<SessionRow[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), COLLECTION), where("startMs", ">=", fromMs), orderBy("startMs", "desc"), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      login: String(x.login ?? ""),
      startMs: Number(x.startMs) || 0,
      lastSeenMs: Number(x.lastSeenMs) || Number(x.startMs) || 0,
      endMs: x.endMs ? Number(x.endMs) : undefined,
      endReason: x.endReason ? String(x.endReason) : undefined,
      activeSec: Number(x.activeSec) || 0,
      idleMin: Number(x.idleMin) || 0,
      longestIdleMin: Number(x.longestIdleMin) || 0,
    };
  });
}
