/** Work features in chat: quote references, approvals with a record, reply-by deadlines, tasks, slash actions. Pure logic. */
import type { ChatMessage, ChatTask } from "./types";

// ---- quote references -------------------------------------------------------------------------------------------

/** References like AEPAY1026IN60278 or CRADV1026IN19953 (desk letters, month and year, IN, number). */
const REF_RE = /\b[A-Z]{3,6}\d{4}IN\d{3,6}\b/g;

export function findQuoteRefs(text: string, max = 3): string[] {
  const found = new Set<string>();
  for (const m of text.toUpperCase().matchAll(REF_RE)) {
    found.add(m[0]);
    if (found.size >= max) break;
  }
  return [...found];
}

// ---- approvals --------------------------------------------------------------------------------------------------

export type ApprovalState =
  | { status: "pending" }
  | { status: "approved" | "declined"; by: string; at: number; note?: string };

/** Who may decide: the people named, or (none named) anyone in the chat other than the person who asked. */
export function canDecide(request: ChatMessage, login: string): boolean {
  const a = request.approval;
  if (!a || login === request.senderLogin) return false;
  return a.approvers.length === 0 || a.approvers.includes(login);
}

/** The earliest valid answer wins. Answers from people who were not allowed to decide are ignored. */
export function approvalState(request: ChatMessage, messages: ChatMessage[]): ApprovalState {
  if (!request.approval) return { status: "pending" };
  const answers = messages
    .filter((m) => m.decision?.forId === request.id && !m.deleted && canDecide(request, m.senderLogin))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
  const first = answers[0];
  if (!first?.decision) return { status: "pending" };
  return { status: first.decision.outcome, by: first.senderLogin, at: first.createdAtMs, note: first.decision.note };
}

// ---- reply-by deadlines -----------------------------------------------------------------------------------------

export const ACK_EMOJI = "✅";

export interface Acknowledgement {
  /** Who was asked: the people tagged in the message, or everyone in the chat but the sender. */
  asked: string[];
  done: string[];
  waiting: string[];
}

/** "Got it" is a ✅ reaction; replying in the chat afterwards counts too. */
export function acknowledgement(msg: ChatMessage, messages: ChatMessage[], members: string[]): Acknowledgement {
  const asked = (msg.mentions?.length ? msg.mentions : members).filter((l) => l !== msg.senderLogin);
  const reacted = new Set(msg.reactions?.[ACK_EMOJI] ?? []);
  const replied = new Set(messages.filter((m) => m.createdAtMs > msg.createdAtMs && !m.ai && !m.deleted).map((m) => m.senderLogin));
  const done = asked.filter((l) => reacted.has(l) || replied.has(l));
  return { asked, done, waiting: asked.filter((l) => !done.includes(l)) };
}

export function isOverdue(replyBy: number | undefined, now: number): boolean {
  return replyBy !== undefined && replyBy < now;
}

/** "4:00 pm", "tomorrow 10:00 am", "Mon 10:00 am", or "9 Nov, 10:00 am" — short, in the viewer's own time. */
export function deadlineLabel(ms: number, now: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/ /g, " ").toLowerCase();
  const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const diffDays = Math.round((dayStart(ms) - dayStart(now)) / 86_400_000);
  if (diffDays === 0) return time;
  if (diffDays === 1) return `tomorrow ${time}`;
  if (diffDays === -1) return `yesterday ${time}`;
  if (diffDays > 1 && diffDays < 7) return `${d.toLocaleDateString("en-IN", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

export interface DeadlinePreset {
  label: string;
  ms: number;
}

/** One-tap choices: in an hour, later today (4 pm, if still ahead), tomorrow morning. */
export function deadlinePresets(now: number): DeadlinePreset[] {
  const out: DeadlinePreset[] = [{ label: "In 1 hour", ms: now + 3_600_000 }];
  const four = new Date(now);
  four.setHours(16, 0, 0, 0);
  if (four.getTime() > now + 15 * 60_000) out.push({ label: "Today 4 pm", ms: four.getTime() });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  out.push({ label: "Tomorrow 10 am", ms: tomorrow.getTime() });
  return out;
}

// ---- tasks ------------------------------------------------------------------------------------------------------

export function newTaskId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Not done, not removed: overdue first, then by due time, then tasks without a time, newest last. */
export function openTasks(tasks: Record<string, ChatTask> | undefined): ChatTask[] {
  return Object.values(tasks ?? {})
    .filter((t) => !t.done && !t.removed)
    .sort((a, b) => (a.dueMs ?? Infinity) - (b.dueMs ?? Infinity) || a.createdAt - b.createdAt);
}

export function dueSoonCount(tasks: Record<string, ChatTask> | undefined, now: number): number {
  const endOfToday = new Date(now).setHours(23, 59, 59, 999);
  return openTasks(tasks).filter((t) => t.dueMs !== undefined && t.dueMs <= endOfToday).length;
}

/** Tasks that have just come due and have not been announced yet. */
export function tasksToAnnounce(tasks: Record<string, ChatTask> | undefined, now: number, announced: Set<string>): ChatTask[] {
  return openTasks(tasks).filter((t) => t.dueMs !== undefined && t.dueMs <= now && !announced.has(t.id));
}

// ---- slash actions ----------------------------------------------------------------------------------------------

export type SlashKey = "quote" | "approve" | "replyby" | "task" | "remind";

export interface SlashCommand {
  key: SlashKey;
  label: string;
  hint: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { key: "quote", label: "/quote", hint: "attach a quote card" },
  { key: "approve", label: "/approve", hint: "ask for a decision" },
  { key: "replyby", label: "/replyby", hint: "ask for a reply by a time" },
  { key: "task", label: "/task", hint: "add a task for yourself" },
  { key: "remind", label: "/remind", hint: "remind yourself later" },
];

/** While the text is just "/" and some letters, the commands that still match. null = not a command. */
export function matchSlash(text: string): SlashCommand[] | null {
  const m = /^\/([a-z]*)$/i.exec(text);
  if (!m) return null;
  const q = m[1].toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.key.startsWith(q));
}

/** "/task call the client" -> { key: "task", rest: "call the client" }. Only commands that take words. */
export function parseSlashWithText(text: string): { key: "task" | "remind"; rest: string } | null {
  const m = /^\/(task|remind)\s+([\s\S]+)$/i.exec(text.trim());
  return m ? { key: m[1].toLowerCase() as "task" | "remind", rest: m[2].trim() } : null;
}

/** Two copies of the same person's tasks (this device and the server): per task, the later change wins. */
export function mergeTasks(a: Record<string, ChatTask> | undefined, b: Record<string, ChatTask> | undefined): Record<string, ChatTask> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, ChatTask> = { ...(a ?? {}) };
  for (const [id, t] of Object.entries(b ?? {})) {
    const cur = out[id];
    if (!cur || (t.updatedAt ?? t.createdAt) >= (cur.updatedAt ?? cur.createdAt)) out[id] = t;
  }
  return out;
}
