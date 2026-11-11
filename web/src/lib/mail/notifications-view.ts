/**
 * The bell: what each notification says and how the list is grouped. Pure, so it is tested.
 */
export interface NotificationItem {
  id: string;
  kind: string;
  level: "need" | "update";
  title: string;
  body: string;
  /** The enquiry it is about (the Inbox opens on it), or "". */
  itemId: string;
  at: number;
  read: boolean;
}

/** "Needs you" first (things that wait for a person), then "Updates". Newest first inside each. */
export function groupNotifications(items: NotificationItem[]): { need: NotificationItem[]; update: NotificationItem[] } {
  const sorted = [...items].sort((a, b) => b.at - a.at);
  return { need: sorted.filter((i) => i.level === "need"), update: sorted.filter((i) => i.level !== "need") };
}

/** Unread count, and how many of them need a person. */
export function unreadCounts(items: NotificationItem[]): { unread: number; needs: number } {
  const unread = items.filter((i) => !i.read);
  return { unread: unread.length, needs: unread.filter((i) => i.level === "need").length };
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
export function agoText(at: number, now: number): string {
  const min = Math.max(0, Math.floor((now - at) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.floor(min / 60)} h ago`;
  return `${Math.floor(min / 1440)} d ago`;
}

/** What the badge shows: nothing at zero, the number, "9+" above nine. */
export const badgeText = (n: number): string => (n <= 0 ? "" : n > 9 ? "9+" : String(n));
