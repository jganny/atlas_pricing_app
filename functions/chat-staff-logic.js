/** Pure helpers for chat-only staff logins. No Firebase here, so they can be tested on their own. */
const crypto = require("crypto");

const DOMAIN = "atlaspricing.com";
const INVITE_DAYS = 7;
const MIN_PASSWORD = 8;

/** "Asha Menon" -> "asha.menon"; one name -> "asha". Letters and numbers only. */
function suggestUsername(name) {
  const parts = String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0];
}

/** 3 to 30 characters: lowercase letters, numbers, dot, dash, underscore; must start with a letter. */
function validUsername(u) {
  return /^[a-z][a-z0-9._-]{2,29}$/.test(String(u || ""));
}

function cleanName(name) {
  return String(name || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** A random link code, and the fingerprint that is stored instead of it (a leaked database copy cannot be used as a link). */
function newInviteToken() {
  return crypto.randomBytes(18).toString("base64url");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function inviteExpiry(now = Date.now()) {
  return now + INVITE_DAYS * 86_400_000;
}

/** null when the invite can be used; otherwise a plain-words reason. */
function inviteProblem(invite, now = Date.now()) {
  if (!invite) return "This link isn't valid. Ask your admin for a new one.";
  if (invite.used) return "This link has already been used. If you forgot your password, ask your admin for a new link.";
  if (invite.expiresAt < now) return "This link has expired. Ask your admin for a new one.";
  return null;
}

function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD) return `Choose a password of at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 128) return "That password is too long.";
  return null;
}

/** Shown to the admin: waiting to be invited / invited / joined / turned off. */
function staffState({ disabled, joinedAt, invitePending }) {
  if (disabled) return "off";
  if (joinedAt) return "joined";
  return invitePending ? "invited" : "ready";
}

module.exports = { DOMAIN, INVITE_DAYS, suggestUsername, validUsername, cleanName, newInviteToken, hashToken, inviteExpiry, inviteProblem, passwordProblem, staffState };
