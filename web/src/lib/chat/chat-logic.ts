/** Team chat — the rules that don't touch the network, kept pure so they can be tested. */
import type { ChatMessage, ChatRoom, ChatState, Me, Person, Presence, Typing } from "./types";

/** Messages (and their files) are removed this many days after they were sent. */
export const RETENTION_DAYS = 100;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT = 4000;
export const EVERYONE_ROOM = "everyone";
export const QUICK_REACTIONS = ["👍", "✅", "❤️", "😂", "🙏", "👀"];
export const ONLINE_WINDOW_MS = 90_000;
export const TYPING_WINDOW_MS = 6_000;
const DAY_MS = 86_400_000;

export const NOTICE_TITLE = "Before you start chatting";
export const NOTICE_BODY =
  "Team chat is for work. Messages and files here are company records: they are kept for " +
  `${RETENTION_DAYS} days and then deleted automatically, and authorised administrators may review them ` +
  "under company policy. Please keep it professional and don't share customer passwords or bank details.";

/** When a message sent at `sentMs` is deleted. */
export function expiryFor(sentMs: number): number {
  return sentMs + RETENTION_DAYS * DAY_MS;
}

export function daysLeft(sentMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiryFor(sentMs) - now) / DAY_MS));
}

export const deskRoomId = (seatId: string) => `desk_${seatId}`;

/** The same two people always get the same room, whoever starts it. */
export function dmRoomId(a: string, b: string): string {
  return `dm_${[a.toLowerCase(), b.toLowerCase()].sort().join("__")}`;
}

export function newId(prefix = "m"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function isMember(room: ChatRoom, login: string): boolean {
  return room.audience === "all" || room.memberLogins.includes(login.toLowerCase());
}

/** What to call a room on screen. A direct chat is named after the other person. */
export function roomTitle(room: ChatRoom, me: string, people: Person[]): string {
  if (room.kind !== "dm") return room.name;
  const other = room.memberLogins.find((l) => l !== me.toLowerCase());
  if (!other) return "Notes to self";
  return people.find((p) => p.login === other)?.name || other || room.name;
}

export interface RoomSection {
  key: "channel" | "group" | "dm";
  title: string;
  rooms: ChatRoom[];
}

export function sectionsFor(rooms: ChatRoom[]): RoomSection[] {
  const byRecent = (a: ChatRoom, b: ChatRoom) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt);
  const pick = (k: RoomSection["key"]) => rooms.filter((r) => r.kind === k).sort(byRecent);
  // Desk channels keep a fixed order (Everyone first) rather than jumping around.
  const channels = rooms
    .filter((r) => r.kind === "channel")
    .sort((a, b) => (a.id === EVERYONE_ROOM ? -1 : b.id === EVERYONE_ROOM ? 1 : a.name.localeCompare(b.name)));
  return [
    { key: "channel", title: "Desks", rooms: channels },
    { key: "group", title: "Groups", rooms: pick("group") },
    { key: "dm", title: "Direct messages", rooms: pick("dm") },
  ];
}

/** Is there something here this person hasn't seen? Nothing counts before they first opened chat. */
export function hasUnread(room: ChatRoom, state: ChatState, me: string): boolean {
  if (!room.lastMessageAt || room.lastMessageBy === me.toLowerCase()) return false;
  if (state.noticeAcceptedAt === undefined) return false;
  const seenUpTo = Math.max(state.reads[room.id] ?? 0, state.noticeAcceptedAt);
  return room.lastMessageAt > seenUpTo;
}

export function wasMentioned(room: ChatRoom, state: ChatState, me: string): boolean {
  const at = room.mentioned?.[me.toLowerCase()];
  if (!at || state.noticeAcceptedAt === undefined) return false;
  return at > Math.max(state.reads[room.id] ?? 0, state.noticeAcceptedAt);
}

/** Muted rooms stay quiet unless someone @mentions you. */
export function badgeRooms(rooms: ChatRoom[], state: ChatState, me: string): number {
  return rooms.filter((r) => hasUnread(r, state, me) && (!state.muted[r.id] || wasMentioned(r, state, me))).length;
}

export function unreadCount(messages: ChatMessage[], since: number, me: string): number {
  return messages.filter((m) => m.createdAtMs > since && m.senderLogin !== me.toLowerCase() && !m.deleted).length;
}

// ---- @mentions, @Vertex and links -----------------------------------------

const VERTEX_RE = /(^|\s)@vertex\b/i;

export function asksVertex(text: string): boolean {
  return VERTEX_RE.test(text);
}

/** The question with the @Vertex tag taken out. */
export function vertexQuestion(text: string): string {
  return text.replace(/(^|\s)@vertex\b[,:]?/gi, "$1").replace(/\s+/g, " ").trim();
}

function mentionNames(p: Person): string[] {
  const full = p.name.trim();
  const first = full.split(/\s+/)[0];
  return [...new Set([full, first, p.login].filter((s) => s.length > 1))].sort((a, b) => b.length - a.length);
}

/** Who a message tags, e.g. "@Shashank can you check" -> ["shashank"]. */
export function parseMentions(text: string, people: Person[]): string[] {
  const found = new Set<string>();
  for (const p of people) {
    for (const name of mentionNames(p)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|\\s)@${escaped}(?![\\w])`, "i").test(text)) {
        found.add(p.login);
        break;
      }
    }
  }
  return [...found];
}

export interface Segment {
  kind: "text" | "link" | "mention" | "vertex";
  value: string;
}

const URL_RE = /(https?:\/\/[^\s<>"')]+)/gi;

/** Splits a message into plain text, links and tags, so it can be shown without raw HTML. */
export function tokenize(text: string, people: Person[]): Segment[] {
  const names = people.flatMap(mentionNames).concat("Vertex");
  const escaped = [...new Set(names)].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tagRe = escaped.length ? new RegExp(`(^|\\s)(@(?:${escaped.join("|")}))(?![\\w])`, "gi") : null;
  const out: Segment[] = [];
  const push = (kind: Segment["kind"], value: string) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (kind === "text" && last?.kind === "text") last.value += value;
    else out.push({ kind, value });
  };
  for (const part of text.split(URL_RE)) {
    if (/^https?:\/\//i.test(part)) {
      push("link", part);
      continue;
    }
    if (!tagRe) {
      push("text", part);
      continue;
    }
    let idx = 0;
    tagRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(part))) {
      const start = m.index + m[1].length;
      push("text", part.slice(idx, start));
      push(m[2].toLowerCase() === "@vertex" ? "vertex" : "mention", m[2]);
      idx = start + m[2].length;
    }
    push("text", part.slice(idx));
  }
  return out;
}

// ---- reading a conversation ------------------------------------------------

export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const today = new Date(now);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export interface DayGroup {
  key: string;
  label: string;
  items: Array<{ msg: ChatMessage; startsRun: boolean }>;
}

/** Messages grouped under day headings; consecutive messages by one person within 5 minutes form a run. */
export function groupByDay(messages: ChatMessage[], now = Date.now()): DayGroup[] {
  const sorted = [...messages].sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id));
  const groups: DayGroup[] = [];
  let prev: ChatMessage | undefined;
  for (const msg of sorted) {
    const d = new Date(msg.createdAtMs);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: dayLabel(msg.createdAtMs, now), items: [] };
      groups.push(g);
      prev = undefined;
    }
    const startsRun = !prev || prev.senderLogin !== msg.senderLogin || !!prev.ai !== !!msg.ai || msg.createdAtMs - prev.createdAtMs > 5 * 60_000 || !!msg.replyTo;
    g.items.push({ msg, startsRun });
    prev = msg;
  }
  return groups;
}

export function searchMessages(messages: ChatMessage[], query: string): ChatMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return messages
    .filter((m) => {
      if (m.deleted) return false;
      const hay = [m.text, m.senderName, m.quote?.customer, m.quote?.ref, ...(m.attachments ?? []).map((a) => a.name)].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function previewText(m: Pick<ChatMessage, "text" | "attachments" | "quote" | "deleted">): string {
  if (m.deleted) return "Message deleted";
  if (m.text.trim()) return m.text.trim().replace(/\s+/g, " ").slice(0, 120);
  if (m.quote) return `Quote ${m.quote.ref} · ${m.quote.customer}`;
  if (m.attachments?.length) return `📎 ${m.attachments[0].name}`;
  return "";
}

export function withReaction(reactions: Record<string, string[]> | undefined, emoji: string, login: string, on: boolean) {
  const next: Record<string, string[]> = {};
  for (const [e, list] of Object.entries(reactions ?? {})) next[e] = [...list];
  const who = new Set(next[emoji] ?? []);
  if (on) who.add(login);
  else who.delete(login);
  if (who.size) next[emoji] = [...who];
  else delete next[emoji];
  return next;
}

export function isOnline(p: Presence | undefined, now = Date.now()): boolean {
  return !!p && now - p.at < ONLINE_WINDOW_MS;
}

export function typingNames(typing: Typing[], me: string, now = Date.now()): string[] {
  return typing.filter((t) => t.login !== me.toLowerCase() && now - t.at < TYPING_WINDOW_MS).map((t) => t.name.split(/\s+/)[0]);
}

export function typingLabel(names: string[]): string {
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

/** Who has seen up to a message: people whose read mark is at or after it. Direct and group chats only. */
export function seenBy(msg: ChatMessage, readMarks: Record<string, number>, me: string): string[] {
  return Object.entries(readMarks)
    .filter(([login, at]) => login !== me.toLowerCase() && login !== msg.senderLogin && at >= msg.createdAtMs)
    .map(([login]) => login);
}

// ---- files -----------------------------------------------------------------

export function fileKind(type: string, name: string): "image" | "pdf" | "audio" | "video" | "sheet" | "doc" | "other" {
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (/\.(xlsx?|csv)$/.test(n)) return "sheet";
  if (/\.(docx?|txt|eml|msg)$/.test(n)) return "doc";
  return "other";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function checkFile(file: { size: number; name: string }): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name} is ${formatBytes(file.size)} — files can be up to ${formatBytes(MAX_FILE_BYTES)}.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

/** Keeps a file name safe to use inside a storage path. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, "_").replace(/[^\w.\- ()+]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.slice(-120) || "file";
}

// ---- the assistant -----------------------------------------------------------

/** The recent conversation as plain lines, for "@Vertex" and "catch me up". Oldest first, capped in size. */
export function transcriptFor(messages: ChatMessage[], maxMessages = 40, maxChars = 7000): string {
  const lines = [...messages]
    .filter((m) => !m.deleted)
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .slice(-maxMessages)
    .map((m) => {
      const bits = [m.text.trim()];
      if (m.quote) bits.push(`[quote ${m.quote.ref} for ${m.quote.customer}, ${m.quote.route}, ${m.quote.status}]`);
      if (m.attachments?.length) bits.push(`[file: ${m.attachments.map((a) => a.name).join(", ")}]`);
      return `${m.ai ? "Vertex" : m.senderName}: ${bits.filter(Boolean).join(" ")}`;
    });
  let text = lines.join("\n");
  if (text.length > maxChars) text = text.slice(text.length - maxChars);
  return text;
}

export function catchUpPrompt(transcript: string): string {
  return (
    "Summarise this team chat for a colleague who has just come back to it. Lead with decisions and anything " +
    "they must act on, then give the short story. Use short bullets, keep names, and do not invent anything.\n\n" +
    transcript
  );
}

export function askPrompt(question: string, transcript: string): string {
  return (
    `A colleague asked you, inside the team chat: "${question}"\n\nThe recent conversation, for context only:\n${transcript}\n\n` +
    "Answer helpfully and briefly (a few lines), as a teammate would. Do not quote rates you have not been shown."
  );
}

export function translatePrompt(text: string): string {
  return `Translate this message into clear English. If it is already English, say so in a few words and give a plainer rewrite. Reply with the translation only.\n\n${text}`;
}

export function pushBody(msg: Pick<ChatMessage, "text" | "attachments" | "quote">): string {
  return previewText({ ...msg, deleted: false }).slice(0, 140);
}

/** People you can message: everyone known except yourself. */
export function otherPeople(people: Person[], me: Me): Person[] {
  return people.filter((p) => p.login !== me.login.toLowerCase());
}
