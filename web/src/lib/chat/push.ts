"use client";

/** Browser notifications for chat when the app isn't open. Needs the person's permission, asked only when they press the button. */
import { getFirebaseApp } from "@/lib/firebase/client";

export type PushState = "unsupported" | "blocked" | "off" | "on";

const TOKEN_KEY = "atlas_chat_push_token";

export function currentPushState(): PushState {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission === "granted") return "on";
  return "off";
}

export interface PushResult {
  state: PushState;
  /** Set when a new device address was obtained and should be saved. */
  token?: string;
  message?: string;
}

/** Asks permission (when `ask`), then registers this device so the server can notify it. */
export async function enablePush(ask: boolean): Promise<PushResult> {
  const before = currentPushState();
  if (before === "unsupported") return { state: "unsupported", message: "This browser can't show notifications while closed. On iPhone or iPad, add Atlas to the Home Screen first." };
  if (before === "blocked") return { state: "blocked", message: "Notifications are blocked for this site. Allow them in the browser's site settings, then try again." };
  if (before === "off") {
    if (!ask) return { state: "off" };
    const answer = await Notification.requestPermission();
    if (answer !== "granted") return { state: answer === "denied" ? "blocked" : "off" };
  }
  try {
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return { state: "unsupported", message: "This browser can't receive background notifications." };
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(getFirebaseApp()), { serviceWorkerRegistration: registration });
    if (!token) return { state: "on", message: "Notifications are allowed, but this device couldn't be registered yet." };
    let known = "";
    try {
      known = localStorage.getItem(TOKEN_KEY) || "";
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode */
    }
    return { state: "on", token: token === known ? undefined : token };
  } catch (e) {
    return { state: "on", message: e instanceof Error ? `Allowed, but couldn't register this device: ${e.message}` : "Allowed, but couldn't register this device." };
  }
}
