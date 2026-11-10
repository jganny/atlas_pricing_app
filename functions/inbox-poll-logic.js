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

/** A sender's identity for learning: the whole address for an ordinary person, never a shared mail host (gmail.com and the like). */
const SHARED_HOSTS = new Set(["gmail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com", "rediffmail.com", "live.com", "icloud.com", "protonmail.com"]);
function senderKey(address) {
  const a = String(address || "").trim().toLowerCase();
  const m = /^[^@\s]+@([^@\s]+)$/.exec(a);
  if (!m) return "";
  const raw = SHARED_HOSTS.has(m[1]) ? a : m[1];
  return raw.replace(/[^a-z0-9@.\-_]/g, "").replace(/\//g, "").slice(0, 120);
}

/** After a handful of the AI's answers about a sender, none of them an enquiry: stop asking. Five unclear mails, none kept. */
const NEVER_AFTER = 5;
function senderNeverEnquires(stats) {
  return !!stats && Number(stats.asked) >= NEVER_AFTER && !Number(stats.kept);
}

/**
 * The attachments of a mail, read from the mail server's description of its parts (no download of the files).
 * [{ filename, contentType, size, inline }]
 */
function attachmentsFromStructure(node, out = []) {
  if (!node || typeof node !== "object") return out;
  const children = Array.isArray(node.childNodes) ? node.childNodes : [];
  if (children.length) {
    children.forEach((c) => attachmentsFromStructure(c, out));
    return out;
  }
  const type = String(node.type || "").toLowerCase();
  if (type.startsWith("text/") && !node.dispositionParameters && !(node.parameters && node.parameters.name)) return out; // the body itself
  if (type.startsWith("multipart/")) return out;
  const filename = String((node.dispositionParameters && node.dispositionParameters.filename) || (node.parameters && node.parameters.name) || "");
  const disposition = String(node.disposition || "").toLowerCase();
  if (!filename && disposition !== "attachment") return out;
  out.push({ filename, contentType: type, size: Number(node.size) || 0, inline: disposition === "inline" });
  return out;
}

module.exports = { nextUids, nextCursor, senderKey, senderNeverEnquires, NEVER_AFTER, attachmentsFromStructure };
