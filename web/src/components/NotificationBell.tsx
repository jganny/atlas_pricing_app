"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { fetchNotifications, markNotificationsRead } from "@/lib/firebase/notifications";
import { agoText, badgeText, groupNotifications, unreadCounts, type NotificationItem } from "@/lib/mail/notifications-view";
import { cn } from "@/lib/utils";

const OPEN_KEY = "atlas_inbox_open";

/**
 * The bell: the complete list of what happened for this person (new enquiries, nobody has opened one, vendor rates read, a circular filed or
 * needing filing by hand). The work bar and the phone pop-ups make people act; the bell is the history they can look back on. Kept 7 days.
 */
export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, refetchInterval: 60_000, staleTime: 30_000, retry: 0 });
  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const counts = unreadCounts(items);
  const groups = groupNotifications(items);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markAll() {
    await markNotificationsRead({ all: true }).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function openItem(i: NotificationItem) {
    setOpen(false);
    if (!i.read) await markNotificationsRead({ ids: [i.id] }).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    if (i.itemId) {
      try {
        window.sessionStorage.setItem(OPEN_KEY, i.itemId);
      } catch {
        /* the Inbox opens on its first item instead */
      }
    }
    router.push("/inbox");
  }

  const Row = ({ i }: { i: NotificationItem }) => (
    <li>
      <button type="button" onClick={() => void openItem(i)} className={cn("flex w-full gap-2 border-b border-slate-100 px-4 py-2.5 text-left hover:bg-sky-50", !i.read && "bg-sky-50/50")}>
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.read ? "bg-slate-300" : i.level === "need" ? "bg-red-500" : "bg-sky-500")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[13px]", i.read ? "text-slate-600" : "font-semibold text-slate-900")}>{i.title}</span>
          {i.body ? <span className="block truncate text-xs text-slate-500">{i.body}</span> : null}
        </span>
        <span className="shrink-0 text-[11px] text-slate-400">{agoText(i.at, now)}</span>
      </button>
    </li>
  );

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={counts.unread ? `Notifications, ${counts.unread} unread` : "Notifications"}
        aria-expanded={open}
        data-testid="notification-bell"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-atlas-navy)] hover:bg-white"
      >
        <Bell className="h-4 w-4" />
        {counts.unread ? (
          <span className={cn("absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white", counts.needs ? "bg-red-600" : "bg-sky-600")}>{badgeText(counts.unread)}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-[100] w-[22rem] max-w-[92vw] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-xl" role="dialog" aria-label="Notifications" data-testid="notification-panel">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
            <b className="text-sm font-semibold text-slate-900">Notifications</b>
            {counts.needs ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{counts.needs} need you</span> : null}
            <button type="button" className="ml-auto text-xs font-semibold text-sky-700 hover:underline" onClick={() => void markAll()}>Mark all read</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">Nothing yet. New enquiries, late ones and rates read for you appear here.</p> : null}
            {groups.need.length ? (
              <>
                <p className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Needs you</p>
                <ul className="m-0 list-none p-0">{groups.need.map((i) => <Row key={i.id} i={i} />)}</ul>
              </>
            ) : null}
            {groups.update.length ? (
              <>
                <p className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Updates</p>
                <ul className="m-0 list-none p-0">{groups.update.map((i) => <Row key={i.id} i={i} />)}</ul>
              </>
            ) : null}
          </div>
          <p className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-slate-500">Kept for 7 days. Only a title and one line, never the email.</p>
        </div>
      ) : null}
    </div>
  );
}
