"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import { useInbox } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { canSeeInboxItem } from "@/lib/mail/inbox-assign";
import { tabTitle, workBarState } from "@/lib/mail/work-bar";
import { cn } from "@/lib/utils";

const OPEN_KEY = "atlas_inbox_open";
const MUTE_KEY = "atlas_workbar_mute";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** A short two-note chime, made in the browser (no file, no download). Silent if the browser refuses audio. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    });
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* no sound */
  }
}

/**
 * One line across the top of every screen: the enquiry that is waiting for someone. It cannot be closed (it goes when the enquiry is opened),
 * it is amber when new and red after 20 minutes, the browser tab shows the count, and a short chime plays when something turns red.
 */
export function WorkBar() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const user = useAuthStore((s) => s.user);
  const { data: rows = [] } = useInbox();
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);
  const lastRed = useRef<string | null>(null);
  const baseTitle = useRef<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const mine = useMemo(() => rows.filter((r) => canSeeInboxItem(user?.username, user?.role, r, user?.email)), [rows, user?.username, user?.role, user?.email]);
  const state = useMemo(() => workBarState(mine, now), [mine, now]);
  const count = state?.count ?? 0;

  // The tab title carries the count, so it is seen even from another tab or from Outlook.
  useEffect(() => {
    if (baseTitle.current === null) baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = tabTitle(baseTitle.current, count);
    return () => {
      if (baseTitle.current !== null) document.title = baseTitle.current;
    };
  }, [count]);

  // A chime once, when an enquiry turns red.
  useEffect(() => {
    if (!state || state.tone !== "red") return;
    if (lastRed.current === state.id) return;
    lastRed.current = state.id;
    if (!readMuted()) chime();
  }, [state]);

  // The saved mute choice is read once the page is in the browser.
  useEffect(() => {
    const m = readMuted();
    const id = window.setTimeout(() => setMuted(m), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!state || pathname.replace(/\/$/, "").endsWith("/inbox")) return null;

  function open() {
    try {
      window.sessionStorage.setItem(OPEN_KEY, state?.id ?? "");
    } catch {
      /* the Inbox opens on its first item instead */
    }
    router.push("/inbox");
  }
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* not saved */
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="work-bar"
      data-tone={state.tone}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 md:px-6",
        state.tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", state.tone === "red" ? "bg-red-600" : "bg-amber-500")} />
      <b className="min-w-0 text-sm font-semibold">{state.headline}</b>
      <span className="text-xs sm:text-[13px]" data-testid="work-bar-detail">{state.detail}</span>
      <span className="flex-1" />
      <button type="button" onClick={toggleMute} aria-label={muted ? "Turn the chime on" : "Turn the chime off"} title={muted ? "Chime is off" : "Chime is on"} className="rounded-md p-1 opacity-70 hover:opacity-100">
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <button type="button" onClick={open} className="rounded-lg bg-[#2b313b] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1f242c]" data-testid="work-bar-open">
        Open it now
      </button>
    </div>
  );
}
