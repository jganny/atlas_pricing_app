/** Voice notes: short audio messages recorded in the chat box. Kept small (low bit rate, two-minute cap). */

export const MAX_VOICE_SECONDS = 120;
/** 24 kbit/s speech is clear and about 0.35 MB for the full two minutes. */
export const VOICE_BITS_PER_SECOND = 24_000;

const CANDIDATES: Array<{ mime: string; ext: string }> = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
];

/** The first recording format this browser can make (Chrome and Android: webm; iPhone Safari: mp4). */
export function pickVoiceFormat(isSupported: (mime: string) => boolean): { mime: string; ext: string } | null {
  return CANDIDATES.find((c) => isSupported(c.mime)) ?? null;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Voice note 0m42s.webm" — the length travels in the name, because recorded files often don't carry it themselves. */
export function voiceFileName(seconds: number, ext: string): string {
  const s = Math.max(1, Math.round(seconds));
  return `Voice note ${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s.${ext}`;
}

export function isVoiceNote(name: string): boolean {
  return /^Voice note \d+m\d{2}s\./.test(name);
}

/** The length in seconds read back from the name, or null for any other file. */
export function voiceSecondsFromName(name: string): number | null {
  const m = /^Voice note (\d+)m(\d{2})s\./.exec(name);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
