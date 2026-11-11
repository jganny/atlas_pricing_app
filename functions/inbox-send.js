/**
 * Replying and forwarding from the app's Inbox, with a copy kept in the real mailbox.
 *
 * A reply goes out by SMTP as the shared mailbox (pricing@ or pricingsales@). SMTP alone never saves a "sent" copy, so the very same
 * message is then appended to the mailbox's Sent folder over IMAP. In Outlook it appears in Sent Items, inside the same conversation
 * (it carries In-Reply-To and References), and the original shows as replied (the \Answered flag) or forwarded.
 * If the copy cannot be saved the mail has still been sent, and the caller is told, never the other way round.
 */
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");
const { ImapFlow } = require("imapflow");
const R = require("./inbox-reply");

const SENT_NAMES = ["sent", "sent items", "sent mail", "sent messages", "inbox.sent", "inbox.sent items"];
const MAX_RECIPIENTS = 12;
const MAX_ATTACH_BYTES = 12 * 1024 * 1024;

/** The Sent folder of a mailbox: the one the server marks as Sent, else a well-known name, else any folder called sent. null if none. */
function pickSentFolder(list) {
  const folders = Array.isArray(list) ? list : [];
  const marked = folders.find((f) => f && f.specialUse === "\\Sent");
  if (marked) return marked.path;
  for (const n of SENT_NAMES) {
    const hit = folders.find((f) => f && String(f.path || "").toLowerCase() === n);
    if (hit) return hit.path;
  }
  const loose = folders.find((f) => f && /sent/i.test(String(f.path || "")) && !/draft|trash|deleted|spam|junk/i.test(String(f.path || "")));
  return loose ? loose.path : null;
}

/** "a@x.com, B <b@y.com>; c@z.com" -> clean unique addresses (invalid ones dropped, and reported). */
function parseAddresses(value) {
  const parts = (Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/)).map((x) => String(x || "").trim()).filter(Boolean);
  const good = [];
  const bad = [];
  for (const p of parts) {
    const m = /<([^>]+)>\s*$/.exec(p);
    const addr = (m ? m[1] : p).trim();
    if (R.isAddress(addr)) {
      if (!good.some((g) => g.toLowerCase() === addr.toLowerCase())) good.push(addr);
    } else bad.push(p);
  }
  return { good, bad };
}

/** The message as bytes, exactly as it will be sent and as it will be saved in Sent. */
function buildRaw(mail) {
  const composer = new MailComposer({
    messageId: mail.messageId || `<${crypto.randomUUID()}@atlaslogistics.co.in>`,
    date: mail.date || new Date(),
    ...mail,
  });
  return new Promise((resolve, reject) => composer.compile().build((err, buf) => (err ? reject(err) : resolve(buf))));
}

/**
 * Sends the raw message and saves a copy in Sent. kind "reply" flags the original answered, "forward" flags it forwarded.
 * Returns { messageId, copied, folder, flagged, copyError }. Throws only when the sending itself failed.
 */
async function sendWithCopy({ imap, smtp, user, password, mail, originalUid, originalMessageId, kind }) {
  const raw = await buildRaw(mail);
  const recipients = [...(mail.to || []), ...(mail.cc || []), ...(mail.bcc || [])];
  const transport = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user, pass: password } });
  const info = await transport.sendMail({ envelope: { from: user, to: recipients }, raw });
  const out = { messageId: info.messageId || mail.messageId || "", copied: false, folder: "", flagged: false, copyError: "" };

  const client = new ImapFlow({ host: imap.host, port: imap.port, secure: imap.secure, auth: { user, pass: password }, logger: false });
  try {
    await client.connect();
    const folder = pickSentFolder(await client.list());
    if (!folder) {
      out.copyError = "No Sent folder was found in the mailbox.";
    } else {
      await client.append(folder, raw, ["\\Seen"], new Date());
      out.copied = true;
      out.folder = folder;
    }
    if (originalUid || originalMessageId) {
      const lock = await client.getMailboxLock(imap.folder);
      try {
        let uid = originalUid || null;
        if (!uid && originalMessageId) {
          const found = await client.search({ header: { "message-id": originalMessageId } }, { uid: true });
          if (Array.isArray(found) && found.length) uid = found[found.length - 1];
        }
        if (uid) {
          await client.messageFlagsAdd(String(uid), [kind === "forward" ? "$Forwarded" : "\\Answered"], { uid: true });
          out.flagged = true;
        }
      } catch (err) {
        out.copyError = out.copyError || `The original could not be marked: ${String((err && err.message) || err).slice(0, 100)}`;
      } finally {
        lock.release();
      }
    }
  } catch (err) {
    out.copyError = out.copyError || `The copy in Sent could not be saved: ${String((err && err.message) || err).slice(0, 140)}`;
  } finally {
    try {
      await client.logout();
    } catch {
      /* already closed */
    }
  }
  return out;
}

const subjectFor = (kind, subject) => {
  const s = String(subject || "").trim() || "(no subject)";
  if (kind === "forward") return /^\s*(fwd?|fw)\s*:/i.test(s) ? s : `Fwd: ${s}`;
  return R.rePrefix(s);
};

module.exports = { pickSentFolder, parseAddresses, buildRaw, sendWithCopy, subjectFor, MAX_RECIPIENTS, MAX_ATTACH_BYTES };
