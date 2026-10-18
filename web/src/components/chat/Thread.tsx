"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Bell, BellOff, Pin, Search, Sparkles, Users, WifiOff, X } from "lucide-react";
import { toast } from "@/components/Toast";
import { Markdown } from "@/components/Markdown";
import { Avatar } from "./Avatar";
import { Composer, type ComposerSend } from "./Composer";
import { MessageItem, type MessageActions } from "./MessageItem";
import { useTeamChat } from "./ChatProvider";
import { cn } from "@/lib/utils";
import { deleteMessage, editMessage, sendAssistantReply, sendChatMessage, togglePin } from "@/lib/chat/actions";
import { runAssistant } from "@/lib/chat/assistant";
import {
  askPrompt,
  asksVertex,
  catchUpPrompt,
  daysLeft,
  groupByDay,
  isOnline,
  previewText,
  roomTitle,
  searchMessages,
  transcriptFor,
  translatePrompt,
  typingLabel,
  typingNames,
  unreadCount,
  vertexQuestion,
  RETENTION_DAYS,
} from "@/lib/chat/chat-logic";
import type { ChatMessage, ChatRoom, Typing } from "@/lib/chat/types";
import { useOnline } from "@/hooks/use-online";

const PAGE = 150;

export function Thread({ room, onBack }: { room: ChatRoom; onBack: () => void }) {
  const chat = useTeamChat();
  const { me, backend, people, presence, state, markRead, setMuted } = chat;
  const online = useOnline();
  const [limit, setLimit] = useState(PAGE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState<Typing[]>([]);
  const [receipts, setReceipts] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, { text: string; busy: boolean }>>({});
  const [catchUp, setCatchUp] = useState<{ text: string; busy: boolean } | null>(null);
  const [vertexBusy, setVertexBusy] = useState(false);
  const [drop, setDrop] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const lastTyped = useRef(0);
  const lastRead = useRef(0);
  const openedUnreadFrom = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const myLogin = me?.login ?? "";
  const title = roomTitle(room, myLogin, people);
  const isDirect = room.kind === "dm";
  const otherLogin = isDirect ? room.memberLogins.find((l) => l !== myLogin) : undefined;

  // Live messages, typing and read receipts for this chat.
  useEffect(() => {
    setMessages([]);
    setTyping([]);
    setReceipts({});
    setReplyTo(null);
    setEditing(null);
    setSearching(false);
    setQuery("");
    setCatchUp(null);
    setLimit(PAGE);
    setAtBottom(true);
    openedUnreadFrom.current = Math.max(state.reads[room.id] ?? 0, state.noticeAcceptedAt ?? 0);
    const u1 = backend.subscribeTyping(room.id, setTyping);
    const u2 = backend.subscribeReceipts(room.id, setReceipts);
    return () => {
      u1();
      u2();
    };
    // Only when switching chat: reading `state` here is for the starting point only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, room.id]);

  useEffect(() => backend.subscribeMessages(room.id, searching ? 1000 : limit, setMessages), [backend, room.id, limit, searching]);

  // Mark as read while it's open and visible; tell the other side ("Seen").
  const tellRead = useCallback(() => {
    if (!me || document.visibilityState !== "visible" || Date.now() - lastRead.current < 1500) return;
    lastRead.current = Date.now();
    markRead(room.id);
    if (room.kind !== "channel") backend.setReceipt(room.id, me.login);
  }, [backend, markRead, me, room.id, room.kind]);

  useEffect(() => {
    tellRead();
  }, [messages.length, tellRead]);
  useEffect(() => {
    document.addEventListener("visibilitychange", tellRead);
    return () => document.removeEventListener("visibilitychange", tellRead);
  }, [tellRead]);

  // Keep the newest message in view when already at the bottom (or when I just sent).
  useEffect(() => {
    const el = scroller.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom, typing]);

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const pinnedIds = room.pinned ?? [];
  const pinnedMsgs = useMemo(() => pinnedIds.map((id) => messages.find((m) => m.id === id)).filter((m): m is ChatMessage => !!m && !m.deleted), [pinnedIds, messages]);
  const results = useMemo(() => (searching ? searchMessages(messages, query) : []), [messages, query, searching]);
  const names = typingNames(typing, myLogin);
  const typingText = typingLabel(vertexBusy ? [...names, "Vertex"] : names);
  const memberPeople = useMemo(
    () => (room.audience === "all" ? people : people.filter((p) => room.memberLogins.includes(p.login))),
    [room, people],
  );
  const muted = !!state.muted[room.id];
  const newCount = unreadCount(messages, openedUnreadFrom.current, myLogin);

  function jump(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      toast("That message is older than what's loaded. Scroll up and choose “Load earlier messages”.", "info");
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlight(id);
    window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1800);
  }

  async function askVertex(sent: ChatMessage, before: ChatMessage[]) {
    if (!me) return;
    const question = vertexQuestion(sent.text);
    if (!question) return;
    setVertexBusy(true);
    try {
      const answer = await runAssistant(askPrompt(question, transcriptFor(before)), { web: true });
      if (answer.trim()) sendAssistantReply(backend, me, room, answer.trim(), sent);
      else toast("Vertex had no answer for that. Try rephrasing.", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Vertex couldn't answer just now.", "error");
    } finally {
      setVertexBusy(false);
    }
  }

  function onSend(s: ComposerSend) {
    if (!me) return;
    const before = messagesRef.current;
    const sent = sendChatMessage({ backend, me, room, people, text: s.text, files: s.files, quote: s.quote, replyTo: replyTo ?? undefined });
    setReplyTo(null);
    setAtBottom(true);
    if (sent && asksVertex(sent.text)) void askVertex(sent, before);
  }

  function onTyping() {
    if (!me || Date.now() - lastTyped.current < 3000) return;
    lastTyped.current = Date.now();
    backend.setTyping(room.id, me.login, me.name);
  }

  async function translate(m: ChatMessage) {
    setTranslations((t) => ({ ...t, [m.id]: { text: "", busy: true } }));
    try {
      const out = await runAssistant(translatePrompt(m.text), { onText: (text) => setTranslations((t) => ({ ...t, [m.id]: { text, busy: true } })) });
      setTranslations((t) => ({ ...t, [m.id]: { text: out.trim(), busy: false } }));
    } catch (e) {
      setTranslations((t) => {
        const { [m.id]: _gone, ...rest } = t;
        void _gone;
        return rest;
      });
      toast(e instanceof Error ? e.message : "Couldn't translate that.", "error");
    }
  }

  async function runCatchUp() {
    setCatchUp({ text: "", busy: true });
    try {
      const out = await runAssistant(catchUpPrompt(transcriptFor(messagesRef.current)), { onText: (text) => setCatchUp({ text, busy: true }) });
      setCatchUp({ text: out.trim() || "Nothing much to report.", busy: false });
    } catch (e) {
      setCatchUp(null);
      toast(e instanceof Error ? e.message : "Couldn't summarise right now.", "error");
    }
  }

  const actions: MessageActions = {
    onReply: (m) => { setEditing(null); setReplyTo(m); },
    onEdit: (m) => { setReplyTo(null); setEditing(m); },
    onDelete: (m) => {
      if (window.confirm("Delete this message for everyone?")) deleteMessage(backend, m);
    },
    onReact: (m, emoji) => {
      if (me) backend.setReaction(room.id, m.id, emoji, me.login, !(m.reactions?.[emoji] ?? []).includes(me.login));
    },
    onPin: (m) => togglePin(backend, room, m.id),
    onTranslate: (m) => void translate(m),
    onJump: jump,
    onCopy: (m) => {
      void navigator.clipboard?.writeText(m.text).then(() => toast("Copied", "success")).catch(() => undefined);
    },
  };

  const seenMark = otherLogin ? receipts[otherLogin] ?? 0 : 0;
  const lastMine = [...messages].reverse().find((m) => m.senderLogin === myLogin && !m.deleted);

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-white"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrop(true); }
      }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrop(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDrop(false);
        setDropped([...e.dataTransfer.files]);
      }}
    >
      {drop ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-atlas-navy)] bg-sky-50/90 text-sm font-bold text-[var(--color-atlas-navy)]">
          Drop files to attach (up to 10 MB each)
        </div>
      ) : null}

      <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Back to chats" className="rounded-full p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="max-sm:hidden"><Avatar name={title} seed={otherLogin || room.id} size={36} group={room.kind !== "dm"} online={otherLogin ? isOnline(presence[otherLogin]) : undefined} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-[var(--color-atlas-navy)]" data-testid="chat-title">
            {room.kind === "channel" ? "# " : ""}
            {title}
          </h2>
          <p className="truncate text-[11px] text-slate-500">
            {typingText
              ? typingText
              : isDirect
                ? isOnline(presence[otherLogin ?? ""])
                  ? "Online"
                  : "Offline"
                : room.audience === "all"
                  ? "Whole team"
                  : `${memberPeople.length} ${memberPeople.length === 1 ? "person" : "people"}`}
          </p>
        </div>
        <button type="button" onClick={() => void runCatchUp()} title="Catch me up — a short AI summary" className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100">
          <Sparkles className="h-3.5 w-3.5" /> <span className="max-sm:hidden">Catch me up</span>
        </button>
        {pinnedMsgs.length ? (
          <button type="button" onClick={() => setShowPins((v) => !v)} aria-label="Pinned messages" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <Pin className="h-4 w-4" />
            <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">{pinnedMsgs.length}</span>
          </button>
        ) : null}
        <button type="button" onClick={() => { setSearching((v) => !v); setQuery(""); }} aria-label="Search this chat" className={cn("rounded-full p-2 hover:bg-slate-100", searching ? "bg-slate-100 text-[var(--color-atlas-navy)]" : "text-slate-500")}>
          <Search className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMuted(room.id, !muted)} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Muted — only @mentions will alert you" : "Mute this chat"} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 max-sm:hidden">
          {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </button>
        <div className="relative">
          <button type="button" onClick={() => setShowMembers((v) => !v)} aria-label="People in this chat" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <Users className="h-4 w-4" />
          </button>
          {showMembers ? (
            <div className="absolute right-0 z-30 mt-1 max-h-72 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button" onClick={() => setMuted(room.id, !muted)} className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 sm:hidden">
                {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />} {muted ? "Unmute this chat" : "Mute this chat"}
              </button>
              <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400">{room.audience === "all" ? "Everyone" : "People"}</div>
              {memberPeople.map((p) => (
                <div key={p.login} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Avatar name={p.name} seed={p.login} size={24} online={isOnline(presence[p.login])} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  {p.desk ? <span className="text-[10px] text-slate-400">{p.desk}</span> : null}
                </div>
              ))}
              {room.kind === "channel" && room.audience === "list" ? <p className="px-3 py-1.5 text-[10px] text-slate-400">This desk chat belongs to the desk. Whoever sits there joins automatically.</p> : null}
            </div>
          ) : null}
        </div>
      </header>

      {searching ? (
        <div className="border-b border-[var(--color-border)] bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages, names, files, quote references" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button type="button" aria-label="Close search" onClick={() => { setSearching(false); setQuery(""); }} className="rounded p-1 hover:bg-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          {query.trim() ? (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm">
              {results.length === 0 ? <li className="px-3 py-3 text-center text-xs text-slate-500">No messages match.</li> : null}
              {results.slice(0, 30).map((m) => (
                <li key={m.id}>
                  <button type="button" className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => jump(m.id)}>
                    <span className="text-[11px] font-bold text-slate-500">{m.senderName} · {new Date(m.createdAtMs).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span className="truncate">{previewText(m)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showPins && pinnedMsgs.length ? (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          {pinnedMsgs.map((m) => (
            <button key={m.id} type="button" className="flex w-full items-center gap-2 py-0.5 text-left hover:underline" onClick={() => { jump(m.id); setShowPins(false); }}>
              <Pin className="h-3 w-3 shrink-0 text-amber-700" />
              <span className="font-bold">{m.senderName}:</span>
              <span className="truncate">{previewText(m)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {!online ? (
        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 text-xs text-white" role="status">
          <WifiOff className="h-3.5 w-3.5" /> You&apos;re offline. You can keep reading and writing — messages and files are sent when you&apos;re back online.
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="h-full overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#f7f9fb,#f2f5f8)] py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          }}
          data-testid="chat-scroll"
        >
          {messages.length >= limit && !searching ? (
            <div className="mb-2 text-center">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Load earlier messages
              </button>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>
          ) : null}
          {groups.map((g) => (
            <div key={g.key}>
              <div className="sticky top-0 z-10 my-2 flex justify-center">
                <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-bold text-slate-500 shadow-sm">{g.label}</span>
              </div>
              {g.items.map(({ msg, startsRun }) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  mine={msg.senderLogin === myLogin && !msg.ai}
                  me={myLogin}
                  startsRun={startsRun}
                  people={people}
                  pinned={pinnedIds.includes(msg.id)}
                  highlighted={highlight === msg.id}
                  seen={lastMine?.id === msg.id && seenMark >= msg.createdAtMs}
                  translation={translations[msg.id]}
                  actions={actions}
                  isDirect={isDirect}
                />
              ))}
            </div>
          ))}
          {typingText ? <p className="px-14 pt-2 text-[11px] italic text-slate-500">{typingText}</p> : null}
          {messages.length > 0 && messages[0] ? (
            <p className="mt-4 px-6 text-center text-[10px] text-slate-400">Messages are kept for {RETENTION_DAYS} days. The oldest here has {daysLeft(messages[0].createdAtMs)} days left.</p>
          ) : null}
        </div>
        {!atBottom ? (
          <button
            type="button"
            onClick={() => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }}
            className="absolute bottom-3 right-4 flex items-center gap-1 rounded-full bg-[var(--color-atlas-navy)] px-3 py-1.5 text-xs font-bold text-white shadow-lg"
          >
            <ArrowDown className="h-3.5 w-3.5" /> {newCount > 0 ? `${newCount} new` : "Latest"}
          </button>
        ) : null}
      </div>

      {catchUp ? (
        <div className="max-h-56 overflow-y-auto border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            <Sparkles className="h-3.5 w-3.5" /> Catch-up (only you can see this)
            <button type="button" aria-label="Close summary" onClick={() => setCatchUp(null)} className="ml-auto rounded p-0.5 hover:bg-amber-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {catchUp.busy && !catchUp.text ? <p className="text-slate-500">Reading the conversation…</p> : <Markdown>{catchUp.text}</Markdown>}
        </div>
      ) : null}

      <Composer
        draftKey={`atlas_chat_draft_${myLogin}_${room.id}`}
        mentionable={memberPeople.filter((p) => p.login !== myLogin)}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={onSend}
        onSaveEdit={(t) => {
          if (editing) editMessage(backend, editing, t, people);
          setEditing(null);
        }}
        onTyping={onTyping}
        droppedFiles={dropped}
        onDroppedHandled={() => setDropped([])}
      />
    </div>
  );
}
