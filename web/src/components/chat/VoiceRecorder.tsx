"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import { toast } from "@/components/Toast";
import { MAX_VOICE_SECONDS, VOICE_BITS_PER_SECOND, formatDuration, pickVoiceFormat, voiceFileName } from "@/lib/chat/voice-note";

/** Recording needs a microphone and a browser that can record. Older browsers simply don't show the button. */
export function canRecordVoice(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Tap the microphone to start, tap Send to stop and send, or the bin to throw it away. Stops by itself at two minutes
 * (and sends what was recorded). The microphone is released the moment recording ends.
 */
export function useVoiceRecorder(onDone: (file: File) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const keep = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const release = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  const finish = useCallback((send: boolean) => {
    keep.current = send;
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
    else release();
  }, [release]);

  const start = useCallback(async () => {
    if (recording) return;
    const format = pickVoiceFormat((m) => MediaRecorder.isTypeSupported(m));
    if (!format) {
      toast("This browser can't record voice notes.", "error");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const r = new MediaRecorder(s, { mimeType: format.mime, audioBitsPerSecond: VOICE_BITS_PER_SECOND });
      chunks.current = [];
      keep.current = true;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = () => {
        const length = (Date.now() - startedAt.current) / 1000;
        const blob = new Blob(chunks.current, { type: format.mime.split(";")[0] });
        const send = keep.current && blob.size > 0 && length >= 1;
        release();
        if (send) onDoneRef.current(new File([blob], voiceFileName(Math.min(length, MAX_VOICE_SECONDS), format.ext), { type: blob.type }));
        else if (keep.current && length < 1) toast("Hold on a little longer — that was too short to send.", "info");
      };
      recorder.current = r;
      startedAt.current = Date.now();
      r.start(1000);
      setRecording(true);
      setSeconds(0);
      timer.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_VOICE_SECONDS) finish(true);
      }, 250);
    } catch (e) {
      release();
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      toast(denied ? "Microphone is blocked. Allow it in your browser or phone settings, then try again." : "Couldn't start the microphone.", "error");
    }
  }, [recording, release, finish]);

  // Leaving the chat while recording throws the recording away and frees the microphone.
  useEffect(() => () => {
    keep.current = false;
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  return { recording, seconds, start, send: () => finish(true), cancel: () => finish(false) };
}

export function MicButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Record a voice note"
      title="Record a voice note"
      data-testid="chat-mic"
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}

/** Replaces the message box while a voice note is being recorded. */
export function RecordingBar({ seconds, onSend, onCancel }: { seconds: number; onSend: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-1.5" data-testid="chat-recording">
      <button type="button" aria-label="Throw away this recording" onClick={onCancel} className="rounded-full p-2 text-red-700 hover:bg-red-100">
        <Trash2 className="h-5 w-5" />
      </button>
      <span className="flex flex-1 items-center gap-2 text-sm font-semibold text-red-800">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden />
        Recording {formatDuration(seconds)}
        <span className="text-xs font-normal text-red-700/70">of {formatDuration(MAX_VOICE_SECONDS)}</span>
      </span>
      <button type="button" aria-label="Send voice note" data-testid="chat-recording-send" onClick={onSend} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white">
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
