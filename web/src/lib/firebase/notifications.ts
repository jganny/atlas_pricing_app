"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import type { NotificationItem } from "@/lib/mail/notifications-view";

const fn = <I, O>(name: string) => httpsCallable<I, O>(getFunctions(getFirebaseApp(), "us-central1"), name, { timeout: 30_000 });

/** This person's own notifications (newest first). */
export async function fetchNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const res = await fn<Record<string, never>, { items: NotificationItem[]; unread: number }>("notificationsList")({});
  return res.data;
}

export async function markNotificationsRead(arg: { ids?: string[]; all?: boolean }): Promise<void> {
  await fn<typeof arg, { ok: boolean }>("notificationsRead")(arg);
}

export interface InboxToday {
  circulars: Array<{ title: string; carrier: string; category: string; at: number }>;
  unfiled: Array<{ subject: string; from: string; carrier: string; mailbox: string; at: number }>;
  saved: Array<{ email: string; type: string }>;
}

/** Circulars filed today, circulars that need filing by hand, and which of the given addresses are saved contacts. */
export async function fetchInboxToday(emails: string[]): Promise<InboxToday> {
  const res = await fn<{ emails: string[] }, InboxToday>("inboxToday")({ emails });
  return res.data;
}
