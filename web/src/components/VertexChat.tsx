"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Copy, Globe, History, Paperclip, Plus, Send, Square, Trash2, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import { searchGuide } from "@/lib/ai/feature-guide";
import { deleteThread, listThreads, saveThread, type ChatThread } from "@/lib/ai/chat-store";
import {
  ChatError,
  DEFAULT_DAILY_LIMIT,
  appContextFrom,
  applyEvent,
  dayKeyIST,
  historyForServer,
  streamChat,
  titleFromQuestion,
  type ChatMessage,
  type ChatTag,
} from "@/lib/ai/vertex-chat";
import { demoAnswer } from "@/lib/ai/demo-chat";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { documentFromFile } from "@/lib/hub/prepare-documents";
import type { HubDocument } from "@/lib/hub/types";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { doc, getDoc } from "firebase/firestore";

const TAG_STYLE: Record<ChatTag, { label: string; cls: string }> = {
  general: { label: "General knowledge", cls: "bg-slate-100 text-slate-700" },
  web: { label: "Web", cls: "bg-sky-100 text-sky-900" },
  quotes: { label: "From your quotes", cls: "bg-emerald-100 text-emerald-900" },
  file: { label: "From your file", cls: "bg-amber-100 text-amber-900" },
};

const SUGGESTIONS = [
  "What's the difference between FCA and FOB?",
  "What did we quote our last Air export customer?",
  "How do I add origin charges on the Courier desk?",
  "Any disruption at Colombo airport this week?",
];

const MAX_ATTACH_B64 = 8.5 * 1024 * 1024;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function rawOf(file: File) {
  return { name: file.name, mime: file.type || "", bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** The Ask Vertex assistant: remembers the conversation, searches the web, reads files, looks up your own quotes. */
export function VertexChat() {
  const pathname = usePathname() || "/";
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState(() => uid());
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Array<{ name: string; doc: HubDocument }>>([]);
  const [mode, setMode] = useState<"quick" | "deep">("deep");
  const [web, setWeb] = useState(true);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState<{ count: number; limit: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await listThreads());
    } catch {
      setThreads([]);
    }
  }, []);

  // Today's count, so "12 of 50 today" is right before the first question.
  useEffect(() => {
    if (!useLiveData) return;
    const u = getFirebaseAuth().currentUser;
    if (!u) return;
    void getDoc(doc(getFirebaseDb(), "chatUsage", `${u.uid}_${dayKeyIST()}`))
      .then((snap) => {
        const admin = ["ganny", "manager", "admin"].includes((user?.username || "").toLowerCase());
        setUsed({ count: snap.exists() ? Number(snap.data().count) || 0 : 0, limit: admin ? 300 : DEFAULT_DAILY_LIMIT });
      })
      .catch(() => undefined);
  }, [user?.username]);

  async function persist(next: ChatMessage[], id: string) {
    const first = next.find((m) => m.role === "user");
    if (!first) return;
    try {
      await saveThread({ id, title: titleFromQuestion(first.content), updatedAt: new Date().toISOString(), messages: next });
    } catch {
      /* history is a convenience — never interrupt the chat */
    }
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    const attached = files;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text, createdAt: new Date().toISOString(), files: attached.map((f) => f.name) };
    const botId = uid();
    const bot: ChatMessage = { id: botId, role: "assistant", content: "", createdAt: new Date().toISOString(), status: "Thinking…" };
    const history = historyForServer(messagesRef.current);
    const base = [...messagesRef.current, userMsg];
    setMessages([...base, bot]);
    setInput("");
    setFiles([]);
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    let current = bot;
    const patch = (next: ChatMessage) => {
      current = next;
      setMessages([...base, next]);
    };

    try {
      if (!useLiveData) {
        const reply = await demoAnswer(text, (chunk) => patch({ ...current, content: current.content + chunk, status: undefined }), ctrl.signal);
        patch({ ...current, tags: reply.tags, sources: reply.sources, status: undefined });
      } else {
        const guide = searchGuide(text, pathname).map((h) => h.entry);
        await streamChat({
          getToken: async () => {
            const u = getFirebaseAuth().currentUser;
            if (!u) throw new Error("not signed in");
            return u.getIdToken();
          },
          text,
          history,
          attachments: attached.map((f) => f.doc),
          mode,
          web,
          appContext: appContextFrom(guide),
          workspace: pathname,
          signal: ctrl.signal,
          onEvent: (ev) => {
            if (ev.t === "done") setUsed({ count: ev.count, limit: ev.limit });
            patch(applyEvent(current, ev));
          },
        });
      }
    } catch (e) {
      const msg = e instanceof ChatError || e instanceof Error ? e.message : "Something went wrong.";
      patch({ ...current, status: undefined, error: msg });
    } finally {
      setBusy(false);
      abort.current = null;
      if (current.content || current.error) {
        const finalMsgs = [...base, { ...current, status: undefined }];
        setMessages(finalMsgs);
        void persist(finalMsgs, threadId).then(() => refreshThreads());
      }
    }
  }

  function stop() {
    abort.current?.abort();
  }

  function newChat() {
    stop();
    setMessages([]);
    setThreadId(uid());
    setFiles([]);
    setShowHistory(false);
  }

  async function openThread(t: ChatThread) {
    stop();
    setMessages(t.messages);
    setThreadId(t.id);
    setShowHistory(false);
  }

  async function removeThread(id: string) {
    await deleteThread(id).catch(() => undefined);
    if (id === threadId) newChat();
    void refreshThreads();
  }

  async function attach(list: FileList | File[]) {
    const picked = Array.from(list).slice(0, 6);
    const out: Array<{ name: string; doc: HubDocument }> = [...files];
    for (const f of picked) {
      try {
        const d = await documentFromFile(await rawOf(f));
        if (d) out.push({ name: f.name, doc: d });
        else toast(`Can't read ${f.name} — use PDF, Excel, Word, text or images.`, "error");
      } catch {
        toast(`Couldn't open ${f.name}.`, "error");
      }
    }
    const size = out.reduce((n, f) => n + (f.doc.kind === "text" ? 0 : f.doc.data.length), 0);
    if (size > MAX_ATTACH_B64) {
      toast("Those files are too large together — attach fewer or smaller files.", "error");
      return;
    }
    setFiles(out);
  }

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => toast("Copied", "success"));
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void attach(e.dataTransfer.files);
      }}
      data-testid="vertex-chat"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]" role="group" aria-label="Answer quality">
          {(["quick", "deep"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn("px-2.5 py-1", mode === m ? "bg-slate-100 font-bold" : "bg-white", m === "deep" && "border-l border-[var(--color-border)]")}
            >
              {m === "quick" ? "Quick" : "Deep"}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={web}
          onClick={() => setWeb((v) => !v)}
          className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1", web ? "border-sky-300 bg-sky-50 font-bold text-sky-900" : "border-[var(--color-border)] bg-white")}
        >
          <Globe className="h-3 w-3" /> Web search
        </button>
        <span className="ml-auto text-[var(--color-text-muted)]">{used ? `${used.count} of ${used.limit} today` : ""}</span>
        <button type="button" aria-label="Chat history" title="Chat history" className="rounded p-1.5 hover:bg-slate-100" onClick={() => { setShowHistory((v) => !v); void refreshThreads(); }}>
          <History className="h-4 w-4" />
        </button>
        <button type="button" aria-label="New chat" title="New chat" className="rounded p-1.5 hover:bg-slate-100" onClick={newChat}>
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Your chats (private to you)</div>
          {threads.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No saved chats yet.</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openThread(t)}>
                    <div className="truncate text-sm font-semibold">{t.title}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">{new Date(t.updatedAt).toLocaleString()}</div>
                  </button>
                  <button type="button" aria-label="Delete chat" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-slate-100" onClick={() => void removeThread(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3" aria-live="polite">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-muted)]">
                Ask anything — freight terms, how to do something in the app, your own past quotes, or general questions. Attach a file with the paperclip.
                {!useLiveData ? " (Demo: sample answers for the suggestions below.)" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[88%] rounded-2xl bg-[var(--color-atlas-navy)] px-3.5 py-2 text-sm text-white">
                {m.files?.length ? <div className="mb-1 text-[11px] opacity-80">📎 {m.files.join(", ")}</div> : null}
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="space-y-1.5">
                {m.tags?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.tags.map((t) => (
                      <span key={t} className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", TAG_STYLE[t].cls)}>
                        {t === "web" && m.sources?.length ? `Web · ${m.sources.length} sources` : TAG_STYLE[t].label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {m.content ? <Markdown>{m.content}</Markdown> : null}
                {m.status ? <div className="animate-pulse text-xs text-[var(--color-text-muted)]">{m.status}</div> : null}
                {m.error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{m.error}</div> : null}
                {m.sources?.length ? (
                  <details className="text-xs text-[var(--color-text-muted)]">
                    <summary className="cursor-pointer font-semibold">Sources</summary>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                      {m.sources.map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-sky-800 underline">
                            {s.title}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
                {m.content && !m.status ? (
                  <button type="button" onClick={() => copy(m.content)} className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        {files.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f.name} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                📎 {f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.name !== f.name))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <button type="button" aria-label="Attach a file" title="Attach a file" className="rounded-lg border border-[var(--color-border)] bg-white p-2 hover:bg-slate-50" onClick={() => fileInput.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileInput} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,image/*" className="hidden" onChange={(e) => { if (e.target.files) void attach(e.target.files); e.target.value = ""; }} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask Vertex…"
            aria-label="Ask Vertex"
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-atlas-sky)]"
          />
          {busy ? (
            <button type="button" aria-label="Stop" title="Stop" className="rounded-lg bg-[var(--color-atlas-navy)] p-2 text-white" onClick={stop}>
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" aria-label="Send" title="Send" disabled={!input.trim()} className="rounded-lg bg-[var(--color-atlas-navy)] p-2 text-white disabled:opacity-40" onClick={() => void send()}>
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-[var(--color-text-muted)]">
          Don&apos;t paste passwords or bank details. Vertex never makes up freight rates — prices come from your quotes and the desks.
        </p>
      </div>
    </div>
  );
}
