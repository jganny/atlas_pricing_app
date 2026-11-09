/**
 * Which messages the inbox poller should read next.
 *
 * The poller remembers the highest message number (UID) it has handled for each mailbox and only reads newer ones,
 * so it never changes anything in the mailbox itself (no "mark as read": your team's unread counts stay true).
 */

/** UIDs from the mail server -> the ones to read now, oldest first. newestFirst: on the very first run take the latest few rather than the oldest. */
function nextUids(found, lastUid, cap, newestFirst = false) {
  const floor = Number.isFinite(lastUid) ? lastUid : 0;
  const list = [...new Set((found || []).map(Number).filter((n) => Number.isInteger(n) && n > floor))].sort((a, b) => a - b);
  return newestFirst ? list.slice(-cap) : list.slice(0, cap);
}

/** Where the cursor goes after a run. tip is the newest UID in the mailbox (known on the first run). */
function nextCursor(lastUid, readUids, tip, firstRun) {
  if (firstRun) return Number.isFinite(tip) ? tip : readUids.length ? Math.max(...readUids) : null;
  return readUids.length ? Math.max(lastUid, ...readUids) : lastUid;
}

module.exports = { nextUids, nextCursor };
