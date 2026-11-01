"use client";

import Link from "next/link";
import { IS_CHAT_APP, PRICING_APP_URL } from "@/lib/chat-app-mode";
import { useState } from "react";
import { AlertCircle, Check, Clock, CornerUpLeft, Download, FileText, Image as ImageIcon, Languages, Pencil, Pin, PinOff, Smile, Trash2, MoreHorizontal, Copy, Sparkles, Forward, Mic } from "lucide-react";
import { Avatar } from "./Avatar";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import { QUICK_REACTIONS, fileKind, formatBytes, timeLabel, tokenize } from "@/lib/chat/chat-logic";
import { formatDuration, isVoiceNote, voiceSecondsFromName } from "@/lib/chat/voice-note";
import type { ChatAttachment, ChatMessage, Person } from "@/lib/chat/types";

export interface MessageActions {
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onPin: (m: ChatMessage) => void;
  onTranslate: (m: ChatMessage) => void;
  onJump: (id: string) => void;
  onCopy: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
}

// In the Vertex Chat app a quote card opens the quote in the Pricing app (a different address), so it is a plain link there.
const QuoteLink = (IS_CHAT_APP ? "a" : Link) as React.ElementType<React.AnchorHTMLAttributes<HTMLAnchorElement>>;

function Attachment({ a }: { a: ChatAttachment }) {
  const kind = fileKind(a.type, a.name);
  const waiting = a.status === "uploading" && !a.url;
  if (kind === "image" && a.url) {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.name} className="max-h-56 max-w-full object-cover" loading="lazy" />
      </a>
    );
  }
  if (kind === "audio" && isVoiceNote(a.name)) {
    const length = voiceSecondsFromName(a.name);
    return (
      <div className="flex min-w-[14rem] max-w-xs items-center gap-2 rounded-lg border border-black/10 bg-white/70 px-2 py-1.5 text-slate-800" data-testid="voice-note">
        <Mic className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        {a.url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls preload="none" src={a.url} className="h-9 min-w-0 flex-1" aria-label={`Voice note${length ? `, ${formatDuration(length)}` : ""}`} />
        ) : (
          <span className="flex-1 text-xs font-semibold">{a.status === "failed" ? "Voice note couldn't be sent" : "Sending voice note…"}</span>
        )}
        {length ? <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{formatDuration(length)}</span> : null}
      </div>
    );
  }
  const Icon = kind === "image" ? ImageIcon : FileText;
  const body = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{a.name}</span>
        <span className="block text-[10px] opacity-70">
          {formatBytes(a.size)}
          {waiting ? " · waiting to upload" : a.status === "failed" ? " · couldn't upload" : ""}
        </span>
      </span>
      {waiting ? <Clock className="h-3.5 w-3.5 shrink-0" /> : a.status === "failed" ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
    </>
  );
  const cls = "flex min-w-[12rem] max-w-xs items-center gap-2 rounded-lg border border-black/10 bg-white/60 px-3 py-2";
  if (a.url) {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:bg-white")}>
        {body}
      </a>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function MessageItem({
  msg,
  mine,
  me,
  startsRun,
  people,
  pinned,
  highlighted,
  seen,
  translation,
  actions,
  isDirect,
}: {
  msg: ChatMessage;
  mine: boolean;
  me: string;
  startsRun: boolean;
  people: Person[];
  pinned: boolean;
  highlighted: boolean;
  seen?: boolean;
  translation?: { text: string; busy: boolean };
  actions: MessageActions;
  isDirect: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  // On a phone there is no hover: tapping a message reveals its actions.
  const [tapped, setTapped] = useState(false);
  const online = undefined;
  const name = msg.ai ? "Vertex" : people.find((p) => p.login === msg.senderLogin)?.name || msg.senderName;
  const segments = tokenize(msg.text, people);
  const reactions = Object.entries(msg.reactions ?? {}).filter(([, who]) => who.length);
  // Anything with words, a quote card or a finished file can be forwarded.
  const canForward = Boolean(msg.text || msg.quote || msg.attachments?.some((a) => a.url && a.status === "ready")) && !msg.pending && !msg.failed;

  if (msg.deleted) {
    return (
      <div id={`msg-${msg.id}`} className={cn("px-2 py-0.5", mine ? "text-right" : "text-left")}>
        <span className="inline-block rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs italic text-slate-400">This message was deleted</span>
      </div>
    );
  }

  return (
    <div
      id={`msg-${msg.id}`}
      className={cn("group relative flex gap-2 px-2", mine ? "flex-row-reverse" : "flex-row", startsRun ? "mt-2.5" : "mt-0.5", highlighted && "rounded-lg bg-amber-100/70 transition-colors")}
      data-testid="chat-message"
    >
      <div className="w-8 shrink-0">{startsRun && !mine ? <Avatar name={name} seed={msg.senderLogin} ai={msg.ai} size={32} online={online} /> : null}</div>
      <div className={cn("flex min-w-0 flex-col", msg.ai ? "max-w-[94%]" : "max-w-[82%]", mine ? "items-end" : "items-start")}>
        {startsRun ? (
          <div className="mb-0.5 flex items-baseline gap-2 px-1 text-[11px] text-slate-500">
            {!mine ? <span className="font-bold text-slate-700">{name}</span> : null}
            {msg.ai ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">
                <Sparkles className="h-2.5 w-2.5" /> assistant · asked by {people.find((p) => p.login === msg.senderLogin)?.name || msg.senderLogin}
              </span>
            ) : null}
            <span>{timeLabel(msg.createdAtMs)}</span>
          </div>
        ) : null}
        <div
          onClick={() => setTapped((v) => !v)}
          className={cn(
            "relative min-w-0 max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
            mine ? "rounded-tr-sm bg-[var(--color-atlas-navy)] text-white" : msg.ai ? "rounded-tl-sm border border-amber-200 bg-amber-50 text-slate-900" : "rounded-tl-sm bg-slate-100 text-slate-900",
          )}
        >
          {msg.forwardedFrom ? (
            <span className={cn("mb-1 flex items-center gap-1 text-[11px] italic", mine ? "text-white/70" : "text-slate-500")} data-testid="forwarded-label">
              <Forward className="h-3 w-3" /> Forwarded from {msg.forwardedFrom.name}
            </span>
          ) : null}
          {msg.replyTo ? (
            <button
              type="button"
              onClick={() => actions.onJump(msg.replyTo!.id)}
              className={cn("mb-1.5 block w-full rounded-lg border-l-4 px-2 py-1 text-left text-xs", mine ? "border-white/60 bg-white/10" : "border-[var(--color-atlas-gold)] bg-white/70")}
            >
              <span className="block font-bold">{msg.replyTo.name}</span>
              <span className="block truncate opacity-80">{msg.replyTo.snippet || "Attachment"}</span>
            </button>
          ) : null}
          {msg.text && msg.ai ? (
            <Markdown>{msg.text}</Markdown>
          ) : msg.text ? (
            <p className="whitespace-pre-wrap break-words">
              {segments.map((s, i) =>
                s.kind === "link" ? (
                  <a key={i} href={s.value} target="_blank" rel="noopener noreferrer" className={cn("underline", mine ? "text-sky-200" : "text-sky-700")}>
                    {s.value}
                  </a>
                ) : s.kind === "mention" || s.kind === "vertex" ? (
                  <span key={i} className={cn("rounded px-0.5 font-bold", mine ? "bg-white/20" : s.kind === "vertex" ? "bg-amber-200/70 text-amber-900" : "bg-sky-100 text-sky-800")}>
                    {s.value}
                  </span>
                ) : (
                  <span key={i}>{s.value}</span>
                ),
              )}
            </p>
          ) : null}
          {msg.quote ? (
            <QuoteLink
              href={IS_CHAT_APP ? `${PRICING_APP_URL}enquiries/?select=${encodeURIComponent(msg.quote.id)}` : `/enquiries?select=${encodeURIComponent(msg.quote.id)}`}
              className={cn("mt-1.5 block rounded-lg border px-3 py-2 text-xs", mine ? "border-white/30 bg-white/10 hover:bg-white/20" : "border-slate-300 bg-white hover:bg-slate-50")}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">
                Quote · {msg.quote.mode} · {msg.quote.status}
              </span>
              <span className="block font-bold">
                {msg.quote.ref} — {msg.quote.customer}
              </span>
              <span className="block opacity-80">{msg.quote.route}</span>
            </QuoteLink>
          ) : null}
          {msg.attachments?.length ? (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {msg.attachments.map((a, i) => (
                <Attachment key={i} a={a} />
              ))}
            </div>
          ) : null}
          {translation ? (
            <div className={cn("mt-2 rounded-lg border-t px-1 pt-1.5 text-xs", mine ? "border-white/30" : "border-slate-300")}>
              <span className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase opacity-70">
                <Languages className="h-3 w-3" /> Translation (AI)
              </span>
              {translation.busy && !translation.text ? "Translating…" : translation.text}
            </div>
          ) : null}
          <span className={cn("ml-2 inline-flex items-center gap-1 align-bottom text-[10px]", mine ? "text-white/60" : "text-slate-400")}>
            {msg.editedAtMs ? "edited" : ""}
            {mine ? (msg.failed ? <span className="flex items-center gap-0.5 text-red-300"><AlertCircle className="h-3 w-3" aria-label="Couldn't send" /> not sent</span> : msg.pending ? <Clock className="h-3 w-3" aria-label="Waiting to send" /> : <Check className="h-3 w-3" aria-label="Sent" />) : null}
          </span>
        </div>
        {reactions.length ? (
          <div className="mt-0.5 flex flex-wrap gap-1 px-1">
            {reactions.map(([emoji, who]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => actions.onReact(msg, emoji)}
                title={who.map((l) => people.find((p) => p.login === l)?.name || l).join(", ")}
                className={cn("rounded-full border px-1.5 py-0.5 text-xs", who.includes(me) ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50")}
              >
                {emoji} {who.length}
              </button>
            ))}
          </div>
        ) : null}
        {pinned ? (
          <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] font-semibold text-amber-700">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        ) : null}
        {mine && isDirect && seen ? <span className="px-1 text-[10px] text-sky-600">Seen</span> : null}
      </div>

      <div className={cn("flex shrink-0 items-start gap-0.5 pt-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100", tapped ? "max-md:opacity-100" : "max-md:hidden", mine ? "flex-row-reverse" : "")}>
        <div className="relative">
          <button type="button" aria-label="Add reaction" onClick={() => { setPicker((v) => !v); setMenu(false); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Smile className="h-4 w-4" />
          </button>
          {picker ? (
            <div className={cn("absolute z-20 mt-1 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg", mine ? "right-0" : "left-0")}>
              {QUICK_REACTIONS.map((e) => (
                <button key={e} type="button" className="rounded p-0.5 text-lg hover:bg-slate-100" onClick={() => { actions.onReact(msg, e); setPicker(false); }}>
                  {e}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" aria-label="Reply" onClick={() => actions.onReply(msg)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <CornerUpLeft className="h-4 w-4" />
        </button>
        {canForward ? (
          <button type="button" aria-label="Forward" title="Forward" data-testid="forward-btn" onClick={() => actions.onForward(msg)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Forward className="h-4 w-4" />
          </button>
        ) : null}
        <div className="relative">
          <button type="button" aria-label="More" onClick={() => { setMenu((v) => !v); setPicker(false); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu ? (
            <div className={cn("absolute z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg", mine ? "right-0" : "left-0")} onClick={() => setMenu(false)}>
              {canForward ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => actions.onForward(msg)}>
                  <Forward className="h-3.5 w-3.5" /> Forward
                </button>
              ) : null}
              {msg.text ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => actions.onCopy(msg)}>
                  <Copy className="h-3.5 w-3.5" /> Copy text
                </button>
              ) : null}
              <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => actions.onPin(msg)}>
                {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {pinned ? "Unpin" : "Pin to top"}
              </button>
              {msg.text ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => actions.onTranslate(msg)}>
                  <Languages className="h-3.5 w-3.5" /> Translate
                </button>
              ) : null}
              {mine && !msg.ai ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => actions.onEdit(msg)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              ) : null}
              {mine ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50" onClick={() => actions.onDelete(msg)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
