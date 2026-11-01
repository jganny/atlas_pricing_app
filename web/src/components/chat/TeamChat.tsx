"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "@/components/Toast";
import { ChatNotice } from "./ChatNotice";
import { NewChatDialog } from "./NewChatDialog";
import { ProfileDialog } from "./ProfileDialog";
import { RoomList } from "./RoomList";
import { Thread } from "./Thread";
import { useTeamChat } from "./ChatProvider";
import { isMember } from "@/lib/chat/chat-logic";
import { CHAT_APP_NAME, CHAT_CLIENT_NAME } from "@/lib/chat-app-mode";

/** The Team chat page: chats on the left, the open conversation on the right (one at a time on a phone). */
export function TeamChat({ standalone = false }: { standalone?: boolean } = {}) {
  const chat = useTeamChat();
  const { me, rooms, roomsReady, stateReady, state, people, presence, activeRoomId, setActiveRoomId, push } = chat;
  const [showNew, setShowNew] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  // A notification link (?room=…) opens that chat once.
  const wanted = useSearchParams()?.get("room");
  const opened = useRef(false);
  useEffect(() => {
    if (wanted && !opened.current && rooms.some((r) => r.id === wanted)) {
      opened.current = true;
      setActiveRoomId(wanted);
    }
  }, [wanted, rooms, setActiveRoomId]);

  // Remember which chat is open so alerts don't repeat for it; clear when leaving the page.
  useEffect(() => () => setActiveRoomId(null), [setActiveRoomId]);

  if (!me) return <p className="p-6 text-sm text-slate-500">Team chat isn&apos;t available for this login.</p>;
  if (!stateReady || !roomsReady) return <p className="p-6 text-sm text-slate-500">Opening chat…</p>;
  if (state.noticeAcceptedAt === undefined) return <ChatNotice onAccept={chat.acceptNotice} />;

  const visible = rooms.filter((r) => isMember(r, me.login));
  const active = visible.find((r) => r.id === activeRoomId) ?? null;
  const others = people.filter((p) => p.login !== me.login);

  return (
    <div className={standalone ? "flex h-full overflow-hidden bg-white" : "flex h-[calc(100dvh-10.5rem)] min-h-[28rem] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white lg:h-[calc(100dvh-8rem)]"} data-testid="team-chat">
      <aside className={`w-full shrink-0 border-r border-[var(--color-border)] lg:block lg:w-80 ${active ? "hidden" : "block"}`}>
        <RoomList
          rooms={visible}
          activeId={activeRoomId}
          me={me.login}
          people={people}
          presence={presence}
          state={state}
          push={push}
          onPick={setActiveRoomId}
          title={standalone ? CHAT_APP_NAME : undefined}
          subtitle={standalone ? CHAT_CLIENT_NAME : undefined}
          onNew={() => setShowNew(true)}
          onProfile={standalone ? undefined : () => setShowProfile(true)}
          onEnablePush={() => void chat.turnOnNotifications().then((m) => m && toast(m, "info"))}
        />
      </aside>
      <section className={`min-w-0 flex-1 ${active ? "block" : "hidden lg:block"}`}>
        {active ? (
          <Thread key={active.id} room={active} onBack={() => setActiveRoomId(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-400">
            <MessageSquare className="h-10 w-10" />
            <p className="text-sm font-semibold">Choose a chat to start</p>
            <p className="max-w-xs text-xs">Desk chats, groups and direct messages work offline too — anything you write is sent when you&apos;re back online.</p>
          </div>
        )}
      </section>
      {showNew ? (
        <NewChatDialog
          meLogin={me.login}
          people={others}
          presence={presence}
          onClose={() => setShowNew(false)}
          onDirect={(login) => {
            setShowNew(false);
            void chat.openDm(login).then(setActiveRoomId).catch(() => toast("Couldn't start that chat. Try again.", "error"));
          }}
          onGroup={(name, logins) => {
            setShowNew(false);
            void chat.createGroup(name, logins).then(setActiveRoomId).catch(() => toast("Couldn't create the group. Try again.", "error"));
          }}
        />
      ) : null}
      {showProfile ? <ProfileDialog onClose={() => setShowProfile(false)} /> : null}
    </div>
  );
}
