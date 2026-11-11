/**
 * "Who is quoting this?" for an Inbox item. Both people who share a mailbox see the same list, so the first one to open a desk from
 * an enquiry leaves a mark on it (their name and the time). The other sees "Shaheer is quoting this" and is asked before taking it
 * over. The mark NEVER expires by itself: someone may be away from the desk, working from home or held up, and the enquiry is still
 * theirs. It goes when the quote is saved (the enquiry leaves the list) or when the other person deliberately takes it over.
 */
export interface WorkingBy {
  username: string;
  name: string;
  at: number;
}

/** The other person who is on this enquiry, or null when nobody else is. How long ago they opened it is shown, never used to drop the mark. */
export function activeWorker(item: { workingBy?: WorkingBy | null }, me: string | undefined | null): WorkingBy | null {
  const w = item.workingBy;
  if (!w || !w.username || !Number.isFinite(w.at)) return null;
  if (me && w.username.toLowerCase() === me.toLowerCase()) return null;
  return w;
}

/** "6 min ago", "just now", "1 h 5 min ago". */
export function agoText(at: number, now: number = Date.now()): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h ago`;
  return `${h} h ${min % 60} min ago`;
}

/** The note shown on the list and above the Quote button. */
export function workingNote(w: WorkingBy, now: number = Date.now()): string {
  return `${w.name || w.username} is quoting this (opened ${agoText(w.at, now)})`;
}

export function markWorking(user: { username: string; displayName?: string }, now: number = Date.now()): WorkingBy {
  return { username: user.username, name: user.displayName || user.username, at: now };
}
