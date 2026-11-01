"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Paperclip, Send, Smile, Sparkles, Ticket, X } from "lucide-react";
import { toast } from "@/components/Toast";
import { QuotePicker } from "./QuotePicker";
import { MicButton, RecordingBar, canRecordVoice, useVoiceRecorder } from "./VoiceRecorder";
import { EMOJI_GROUPS } from "./emoji";
import { cn } from "@/lib/utils";
import { MAX_TEXT, formatBytes } from "@/lib/chat/chat-logic";
import { validateFiles } from "@/lib/chat/actions";
import type { ChatMessage, Person, QuoteCard } from "@/lib/chat/types";

export interface ComposerSend {
  text: string;
  files: File[];
  quote?: QuoteCard;
}

/** Text box with @mentions, emoji, files (button, paste or drop), quote cards, reply and edit. Drafts are kept per chat. */
export function Composer({
  draftKey,
  mentionable,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onTyping,
  droppedFiles,
  onDroppedHandled,
}: {
  draftKey: string;
  mentionable: Person[];
  replyTo?: ChatMessage | null;
  editing?: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (s: ComposerSend) => void;
  onSaveEdit: (text: string) => void;
  onTyping: () => void;
  droppedFiles: File[];
  onDroppedHandled: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [quote, setQuote] = useState<QuoteCard | undefined>();
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [mentionAt, setMentionAt] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Restore this chat's unsent draft when switching chats.
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(draftKey) || "";
    } catch {
      /* private mode */
    }
    setText(saved);
    setFiles([]);
    setQuote(undefined);
    setShowEmoji(false);
    setShowQuotes(false);
  }, [draftKey]);

  useEffect(() => {
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {
      /* private mode */
    }
  }, [text, draftKey]);

  useEffect(() => {
    if (editing) {
      setText(editing.text);
      area.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) area.current?.focus();
  }, [replyTo]);

  const addFiles = useCallback((incoming: File[]) => {
    const { ok, problems } = validateFiles(incoming);
    problems.forEach((p) => toast(p, "error"));
    if (ok.length) setFiles((cur) => [...cur, ...ok].slice(0, 10));
  }, []);

  useEffect(() => {
    if (droppedFiles.length) {
      addFiles(droppedFiles);
      onDroppedHandled();
    }
  }, [droppedFiles, addFiles, onDroppedHandled]);

  // Auto-grow up to a limit.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const suggestions = useMemo(() => {
    if (!mentionAt) return [];
    const q = mentionAt.query.toLowerCase();
    const all: Array<{ key: string; label: string; sub?: string; insert: string }> = [
      { key: "vertex", label: "Vertex", sub: "Ask the assistant", insert: "Vertex" },
      ...mentionable.map((p) => ({ key: p.login, label: p.name, sub: p.desk, insert: p.name.split(/\s+/)[0] })),
    ];
    return all.filter((s) => !q || s.label.toLowerCase().includes(q) || s.key.includes(q)).slice(0, 6);
  }, [mentionAt, mentionable]);

  function onChange(value: string, caret: number) {
    setText(value.slice(0, MAX_TEXT));
    onTyping();
    const upto = value.slice(0, caret);
    const m = /(^|\s)@([\w.-]{0,20})$/.exec(upto);
    if (m) {
      setMentionAt({ start: caret - m[2].length - 1, query: m[2] });
      setMentionIdx(0);
    } else setMentionAt(null);
  }

  function insertMention(insert: string) {
    if (!mentionAt) return;
    const el = area.current;
    const caret = el?.selectionStart ?? text.length;
    const next = `${text.slice(0, mentionAt.start)}@${insert} ${text.slice(caret)}`;
    setText(next);
    setMentionAt(null);
    requestAnimationFrame(() => {
      const pos = mentionAt.start + insert.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    if (editing) {
      onSaveEdit(text);
      setText("");
      return;
    }
    if (!text.trim() && !files.length && !quote) return;
    onSend({ text, files, quote });
    setText("");
    setFiles([]);
    setQuote(undefined);
    setShowEmoji(false);
  }

  const canSend = !!(text.trim() || files.length || quote);
  const voice = useVoiceRecorder((file) => onSend({ text: "", files: [file] }));
  // The microphone stands where Send would be while there is nothing to send (like WhatsApp). Not while editing.
  const showMic = !canSend && !editing && canRecordVoice();

  return (
    <div className="relative border-t border-[var(--color-border)] bg-white px-3 pb-3 pt-2">
      {showQuotes ? <QuotePicker onPick={(q) => { setQuote(q); setShowQuotes(false); }} onClose={() => setShowQuotes(false)} /> : null}
      {suggestions.length ? (
        <ul className="absolute bottom-full left-3 z-30 mb-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox">
          {suggestions.map((s, i) => (
            <li key={s.key} role="option" aria-selected={i === mentionIdx}>
              <button
                type="button"
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === mentionIdx ? "bg-sky-50" : "hover:bg-slate-50")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s.insert);
                }}
              >
                {s.key === "vertex" ? <Sparkles className="h-4 w-4 text-amber-600" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold">{s.label[0]}</span>}
                <span className="font-semibold">{s.label}</span>
                {s.sub ? <span className="ml-auto text-[10px] text-slate-400">{s.sub}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-[var(--color-atlas-gold)] bg-slate-50 px-3 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <div className="font-bold">Replying to {replyTo.ai ? "Vertex" : replyTo.senderName}</div>
            <div className="truncate text-slate-500">{replyTo.text || replyTo.attachments?.[0]?.name || "Attachment"}</div>
          </div>
          <button type="button" aria-label="Cancel reply" onClick={onCancelReply} className="rounded p-0.5 hover:bg-slate-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      {editing ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
          Editing message
          <button type="button" className="ml-auto underline" onClick={() => { setText(""); onCancelEdit(); }}>
            Cancel
          </button>
        </div>
      ) : null}
      {quote ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
          <Ticket className="h-4 w-4 text-[var(--color-atlas-navy)]" />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {quote.ref} · {quote.customer} · {quote.route}
          </span>
          <button type="button" aria-label="Remove quote" onClick={() => setQuote(undefined)} className="rounded p-0.5 hover:bg-slate-200">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      {files.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[10rem] truncate font-semibold">{f.name}</span>
              <span className="text-slate-400">{formatBytes(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-slate-200">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {voice.recording ? <RecordingBar seconds={voice.seconds} onSend={voice.send} onCancel={voice.cancel} /> : null}
      <div className={cn("flex items-end gap-1.5", voice.recording && "hidden")}>
        <div className="flex shrink-0 items-center">
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
          <button type="button" aria-label="Attach a file" title="Attach a file (up to 10 MB)" onClick={() => fileInput.current?.click()} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <Paperclip className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Share a quote" title="Share a quote" onClick={() => { setShowQuotes((v) => !v); setShowEmoji(false); }} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <Ticket className="h-5 w-5" />
          </button>
          <div className="relative">
            <button type="button" aria-label="Emoji" title="Emoji" onClick={() => { setShowEmoji((v) => !v); setShowQuotes(false); }} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <Smile className="h-5 w-5" />
            </button>
            {showEmoji ? (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {EMOJI_GROUPS.map((g) => (
                  <div key={g.label} className="mb-1">
                    <div className="px-1 text-[10px] font-bold uppercase text-slate-400">{g.label}</div>
                    <div className="grid grid-cols-8 gap-0.5">
                      {g.items.map((e) => (
                        <button key={e} type="button" className="rounded p-1 text-lg hover:bg-slate-100" onClick={() => { setText((t) => t + e); area.current?.focus(); }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <textarea
          ref={area}
          rows={1}
          value={text}
          data-testid="chat-input"
          aria-label="Message"
          placeholder="Message — @ to tag someone"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-[var(--color-border)] bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-[var(--color-atlas-navy)] focus:bg-white"
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % suggestions.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(suggestions[mentionIdx].insert); return; }
              if (e.key === "Escape") { setMentionAt(null); return; }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              if (editing) { setText(""); onCancelEdit(); }
              else if (replyTo) onCancelReply();
            }
          }}
          onPaste={(e) => {
            const pasted = [...e.clipboardData.files];
            if (pasted.length) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
        />
        {showMic ? <MicButton onClick={() => void voice.start()} /> : (
        <button
          type="button"
          aria-label={editing ? "Save changes" : "Send"}
          data-testid="chat-send"
          disabled={!canSend}
          onClick={submit}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
        )}
      </div>
    </div>
  );
}
