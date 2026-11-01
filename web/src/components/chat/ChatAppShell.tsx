"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, ExternalLink, LogOut, MessagesSquare, MoreHorizontal, UserRound, Users } from "lucide-react";
import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { toast } from "@/components/Toast";
import { Avatar } from "./Avatar";
import { ChatProvider, useTeamChat } from "./ChatProvider";
import { TeamChat } from "./TeamChat";
import { ProfileDialog } from "./ProfileDialog";
import { CHAT_APP_NAME, CHAT_CLIENT_NAME, PRICING_APP_URL } from "@/lib/chat-app-mode";
import { isOnline } from "@/lib/chat/chat-logic";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

type Tab = "chats" | "people" | "more";

/** The whole screen of the Vertex Chat app: chats, people, and a small More page. No pricing desks. */
export function ChatAppShell() {
  return (
    <AuthGuard>
      <ChatProvider>
        <Frame />
      </ChatProvider>
    </AuthGuard>
  );
}

function Frame() {
  const chat = useTeamChat();
  const [tab, setTab] = useState<Tab>("chats");
  const threadOpen = chat.activeRoomId !== null;
  // While a conversation is open on a phone it gets the whole screen, like WhatsApp.
  const hideTabs = threadOpen && tab === "chats";

  return (
    <div className="flex h-[100dvh] flex-col bg-white" data-testid="chat-app">
      <main className="min-h-0 flex-1">
        {tab === "chats" ? (
          <Suspense fallback={null}>
            <TeamChat standalone />
          </Suspense>
        ) : tab === "people" ? (
          <PeopleTab onOpened={() => setTab("chats")} />
        ) : (
          <MoreTab />
        )}
      </main>
      <nav
        aria-label="Sections"
        className={cn("grid grid-cols-3 border-t border-[var(--color-border)] bg-white pb-[env(safe-area-inset-bottom)]", hideTabs && "max-lg:hidden")}
      >
        <TabButton active={tab === "chats"} label="Chats" badge={chat.badge} onClick={() => setTab("chats")} icon={<MessagesSquare className="h-5 w-5" />} />
        <TabButton active={tab === "people"} label="People" onClick={() => setTab("people")} icon={<Users className="h-5 w-5" />} />
        <TabButton active={tab === "more"} label="More" onClick={() => setTab("more")} icon={<MoreHorizontal className="h-5 w-5" />} />
      </nav>
    </div>
  );
}

function TabButton({ active, label, badge, icon, onClick }: { active: boolean; label: string; badge?: number; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-testid={`tab-${label.toLowerCase()}`}
      className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-[var(--color-atlas-navy)]" : "text-slate-500")}
    >
      <span className="relative">
        {icon}
        {badge ? <span className="absolute -right-2.5 -top-1.5 rounded-full bg-[var(--color-atlas-error)] px-1 text-[9px] font-extrabold text-white">{badge}</span> : null}
      </span>
      {label}
    </button>
  );
}

function PeopleTab({ onOpened }: { onOpened: () => void }) {
  const chat = useTeamChat();
  const me = chat.me?.login ?? "";
  const others = chat.people.filter((p) => p.login !== me);
  return (
    <div className="flex h-full flex-col" data-testid="people-tab">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-base font-extrabold text-[var(--color-atlas-navy)]">People</h1>
        <p className="text-xs text-[var(--color-text-muted)]">{CHAT_CLIENT_NAME} staff. Tap a name to start a chat.</p>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {others.map((p) => (
          <li key={p.login}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              onClick={() => void chat.openDm(p.login).then((id) => { chat.setActiveRoomId(id); onOpened(); }).catch(() => toast("Couldn't start that chat. Try again.", "error"))}
            >
              <Avatar name={p.name} seed={p.login} size={40} online={isOnline(chat.presence[p.login])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs text-[var(--color-text-muted)]">
                  {chat.profiles[p.login]?.status ? `${chat.profiles[p.login]?.status}${p.desk ? ` · ${p.desk}` : ""}` : p.desk || "Staff"}
                </span>
              </span>
            </button>
          </li>
        ))}
        {others.length === 0 ? <li className="px-4 py-8 text-center text-sm text-slate-500">No colleagues to show yet.</li> : null}
      </ul>
    </div>
  );
}

function MoreTab() {
  const chat = useTeamChat();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "";
  const [editing, setEditing] = useState(false);
  const mine = chat.me ? chat.profiles[chat.me.login] : undefined;
  return (
    <>
    <div className="h-full overflow-y-auto" data-testid="more-tab">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h1 className="text-base font-extrabold text-[var(--color-atlas-navy)]">More</h1>
        <p className="text-xs text-[var(--color-text-muted)]">Signed in as {chat.me?.name}</p>
      </header>
      <ul className="divide-y divide-[var(--color-border)] text-sm">
        <li>
          <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setEditing(true)} data-testid="open-profile">
            {chat.me ? <Avatar name={chat.me.name} seed={chat.me.login} size={32} /> : <UserRound className="h-5 w-5 text-slate-500" />}
            <span className="flex-1">
              <span className="block font-semibold">My profile</span>
              <span className="block text-xs text-[var(--color-text-muted)]">{mine?.status || "Add a photo and a status"}</span>
            </span>
          </button>
        </li>
        <li>
          <a href={PRICING_APP_URL} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50" data-testid="open-pricing-app">
            <ExternalLink className="h-5 w-5 text-slate-500" />
            <span className="flex-1 font-semibold">Open the Pricing app</span>
          </a>
        </li>
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
            onClick={() => void chat.turnOnNotifications().then((m) => toast(m || (chat.push === "on" ? "Notifications are on." : "Done."), "info"))}
          >
            <BellRing className="h-5 w-5 text-slate-500" />
            <span className="flex-1">
              <span className="block font-semibold">Alerts</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                {chat.push === "on" ? "On for this phone" : chat.push === "blocked" ? "Blocked — allow them in your phone settings" : chat.push === "unsupported" ? "Add this app to your Home Screen first" : "Tap to turn on notifications"}
              </span>
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
            onClick={() => void logout().then(() => router.replace("/login"))}
            data-testid="chat-signout"
          >
            <LogOut className="h-5 w-5 text-slate-500" />
            <span className="flex-1 font-semibold">Sign out</span>
          </button>
        </li>
      </ul>
      <p className="px-4 py-4 text-xs leading-relaxed text-[var(--color-text-muted)]">
        Work chats are company records, kept 100 days. Administrators may review them under company policy.
      </p>
      <p className="px-4 pb-6 text-[11px] text-[var(--color-text-muted)]">
        {CHAT_APP_NAME} · {CHAT_CLIENT_NAME}
        {version ? ` · v${version}` : ""}
      </p>
    </div>
    {editing ? <ProfileDialog onClose={() => setEditing(false)} /> : null}
    </>
  );
}
