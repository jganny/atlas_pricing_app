/**
 * "Who is quoting this?" for an Inbox item. Both people who share a mailbox see the same list, so the first one to open a desk from
 * an enquiry leaves a mark on it (their name and the time). The other sees "Shaheer is quoting this" and is asked before taking it
 * over. A mark goes stale after 45 minutes, so an enquiry that was opened and forgotten is free again.
 */
export interface WorkingBy {
  username: string;
  name: string;
  at: number;
}

export const WORKING_MINUTES = 45;

/** The other person who is currently on this enquiry, or null when nobody else is (or the mark has gone stale). */
export function activeWorker(item: { workingBy?: WorkingBy | null }, me: string | undefined | null, now: number = Date.now()): WorkingBy | null {
  const w = item.workingBy;
  if (!w || !w.username || !Number.isFinite(w.at)) return null;
  if (me && w.username.toLowerCase() === me.toLowerCase()) return null;
  if (now - w.at > WORKING_MINUTES * 60_000) return null;
  return w;
}

/** "6 min ago", "just now", "1 h 5 min ago". */
export function agoText(at: number, now: number = Date.now()): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min ago`;
}

/** The note shown on the list and above the Quote button. */
export function workingNote(w: WorkingBy, now: number = Date.now()): string {
  return `${w.name || w.username} is quoting this (opened ${agoText(w.at, now)})`;
}

export function markWorking(user: { username: string; displayName?: string }, now: number = Date.now()): WorkingBy {
  return { username: user.username, name: user.displayName || user.username, at: now };
}
