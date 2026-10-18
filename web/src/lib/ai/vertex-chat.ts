/**
 * Ask Vertex chat — the browser side: message shapes, how the server's stream is read and folded
 * into a message, and the call itself. Pure parts are tested; the fetch is the only network code.
 */
import type { GuideEntry } from "@/lib/ai/feature-guide";
import type { HubDocument } from "@/lib/hub/types";

export type ChatTag = "general" | "web" | "quotes" | "file";
export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Where an assistant answer came from — shown as small badges. */
  tags?: ChatTag[];
  sources?: ChatSource[];
  /** Names of files attached to a question. */
  files?: string[];
  /** Live progress such as "Searching the web…" while an answer is being made. */
  status?: string;
  error?: string;
}

export type ChatEvent =
  | { t: "delta"; text: string }
  | { t: "status"; text: string }
  | { t: "sources"; items: ChatSource[] }
  | { t: "used"; web: number; quotes: boolean; files: boolean }
  | { t: "done"; count: number; limit: number }
  | { t: "error"; message: string };

export class ChatError extends Error {
  constructor(
    message: string,
    readonly kind: "signin" | "limit" | "unavailable" | "other",
  ) {
    super(message);
  }
}

/** Splits streamed text into complete JSON events, keeping any unfinished last line for next time. */
export function parseLines(buffer: string): { events: ChatEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as ChatEvent);
    } catch {
      /* ignore a damaged line */
    }
  }
  return { events, rest };
}

export function tagsFor(used: { web: number; quotes: boolean; files: boolean }): ChatTag[] {
  const tags: ChatTag[] = [];
  if (used.web > 0) tags.push("web");
  if (used.quotes) tags.push("quotes");
  if (used.files) tags.push("file");
  return tags.length ? tags : ["general"];
}

/** Folds one server event into the answer being built. */
export function applyEvent(msg: ChatMessage, ev: ChatEvent): ChatMessage {
  switch (ev.t) {
    case "delta":
      return { ...msg, content: msg.content + ev.text, status: undefined };
    case "status":
      return { ...msg, status: ev.text };
    case "sources":
      return { ...msg, sources: ev.items.slice(0, 8) };
    case "used":
      return { ...msg, tags: tagsFor(ev) };
    case "done":
      return { ...msg, status: undefined };
    case "error":
      return { ...msg, status: undefined, error: ev.message };
    default:
      return msg;
  }
}

/** What the server needs to remember the conversation: recent finished turns, text only. */
export function historyForServer(messages: ChatMessage[], max = 30): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.content.trim() && !m.error)
    .slice(-max)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function titleFromQuestion(q: string): string {
  const t = q.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 47)}…` : t || "New chat";
}

/** The few app-guide entries that match the question, as plain text for how-do-I answers. */
export function appContextFrom(entries: GuideEntry[]): string {
  return entries
    .slice(0, 3)
    .map((e) => [`## ${e.title}`, `Where: ${e.where}`, e.summary, ...e.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n"))
    .join("\n\n");
}

/** IST calendar day as YYYYMMDD — matches the server's daily-limit key. */
export function dayKeyIST(now = Date.now()): string {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
}

export const DEFAULT_DAILY_LIMIT = 50;

const STREAM_URL = "https://us-central1-vertex-35d95.cloudfunctions.net/vertexChat";

export interface StreamOptions {
  getToken: () => Promise<string>;
  text: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  attachments: HubDocument[];
  mode: "quick" | "deep";
  web: boolean;
  appContext?: string;
  workspace?: string;
  /** false = the assistant may not look up the person's own quotes (used where others can read the answer). */
  quotes?: boolean;
  signal?: AbortSignal;
  onEvent: (ev: ChatEvent) => void;
}

/** Sends the question and reads the answer as it arrives. */
export async function streamChat(o: StreamOptions): Promise<void> {
  let token: string;
  try {
    token = await o.getToken();
  } catch {
    throw new ChatError("Please sign in again to use Ask Vertex.", "signin");
  }
  let res: Response;
  try {
    res = await fetch(STREAM_URL, {
      method: "POST",
      signal: o.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: o.text,
        history: o.history,
        attachments: o.attachments,
        mode: o.mode,
        web: o.web,
        appContext: o.appContext,
        workspace: o.workspace,
        quotes: o.quotes,
      }),
    });
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return;
    throw new ChatError("Couldn't reach Ask Vertex. Check your connection and try again.", "unavailable");
  }
  if (!res.ok) {
    let message = "Ask Vertex is temporarily unavailable. Try again shortly.";
    try {
      message = ((await res.json()) as { error?: string }).error || message;
    } catch {
      /* keep the default */
    }
    throw new ChatError(message, res.status === 429 ? "limit" : res.status === 401 ? "signin" : "unavailable");
  }
  const reader = res.body?.getReader();
  if (!reader) throw new ChatError("Your browser can't show streamed answers.", "other");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseLines(buffer);
      buffer = parsed.rest;
      parsed.events.forEach(o.onEvent);
    }
    if (buffer.trim()) parseLines(`${buffer}\n`).events.forEach(o.onEvent);
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return;
    throw new ChatError("The answer was interrupted. Try again.", "unavailable");
  }
}
