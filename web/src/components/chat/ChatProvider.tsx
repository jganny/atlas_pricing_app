"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import { personDisplayName } from "@/lib/auth/desk-seats";
import { canAccessRoute } from "@/lib/auth/rbac";
import { IS_DEMO_BUILD } from "@/lib/demo-mode";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { processOutbox } from "@/lib/chat/actions";
import { badgeRooms, dmRoomId, isMember, newId, wasMentioned } from "@/lib/chat/chat-logic";
import { firestoreBackend } from "@/lib/chat/firestore-backend";
import { mockBackend } from "@/lib/chat/mock-backend";
import { channelsToSync, desiredChannels, listPeople } from "@/lib/chat/people";
import { currentPushState, enablePush, type PushState } from "@/lib/chat/push";
import type { ChatBackend, ChatRoom, ChatState, Me, Person, Presence } from "@/lib/chat/types";
import { useSeatsVersion } from "@/hooks/use-seats-version";
import { useAuthStore } from "@/store/auth";

export interface ChatContextValue {
  enabled: boolean;
  me: Me | null;
  backend: ChatBackend;
  rooms: ChatRoom[];
  roomsReady: boolean;
  state: ChatState;
  stateReady: boolean;
  people: Person[];
  presence: Record<string, Presence>;
  /** Number of conversations with something new (muted ones excluded). */
  badge: number;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  markRead: (roomId: string) => void;
  acceptNotice: () => void;
  setMuted: (roomId: string, muted: boolean) => void;
  openDm: (login: string) => Promise<string>;
  createGroup: (name: string, logins: string[]) => Promise<string>;
  push: PushState;
  turnOnNotifications: () => Promise<string | undefined>;
}

const EMPTY_STATE: ChatState = { reads: {}, muted: {} };
const backendFor = () => (useLiveData ? firestoreBackend : mockBackend);

const Ctx = createContext<ChatContextValue | null>(null);

export function useTeamChat(): ChatContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTeamChat must be used inside ChatProvider");
  return v;
}

/** Same as useTeamChat but returns null outside the provider (e.g. in isolated tests). */
export function useTeamChatOptional(): ChatContextValue | null {
  return useContext(Ctx);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const seatsVersion = useSeatsVersion();
  const backend = useMemo(backendFor, []);
  const enabled = !!user && canAccessRoute(user.username, user.role, "chat");

  const me = useMemo<Me | null>(() => {
    if (!user || !enabled) return null;
    const login = user.username.toLowerCase();
    return { login, name: personDisplayName(login, user.displayName), isAdmin: isAdminUser(user.username, user.role) };
    // seatsVersion: the shown name can change when a desk seat is reassigned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, enabled, seatsVersion]);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomsReady, setRoomsReady] = useState(false);
  const [state, setState] = useState<ChatState>(EMPTY_STATE);
  const [stateReady, setStateReady] = useState(false);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>("unsupported");
  const login = me?.login;

  const people = useMemo(() => listPeople(), [seatsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rooms, this person's read marks, and who is online.
  useEffect(() => {
    if (!me) return;
    setRoomsReady(false);
    setStateReady(false);
    const u1 = backend.subscribeRooms(me, (r) => {
      setRooms(r);
      setRoomsReady(true);
    });
    const u2 = backend.subscribeState(me.login, (s) => {
      setState(s);
      setStateReady(true);
    });
    const u3 = backend.subscribePresence((list) => setPresence(Object.fromEntries(list.map((p) => [p.login, p]))));
    return () => {
      u1();
      u2();
      u3();
    };
  }, [backend, me]);

  // Admin keeps the desk channels matching whoever sits in each seat.
  useEffect(() => {
    if (!me?.isAdmin || !roomsReady) return;
    const todo = channelsToSync(rooms, desiredChannels());
    if (todo.length) void backend.syncDeskChannels(todo).catch((e) => console.warn("Team chat channels:", e));
  }, [backend, me, rooms, roomsReady, seatsVersion]);

  const accepted = state.noticeAcceptedAt !== undefined;

  // "Online" dot: a light heartbeat while the app is open and visible.
  useEffect(() => {
    if (!me || !accepted) return;
    const beat = () => {
      if (document.visibilityState === "visible" && navigator.onLine) backend.heartbeat(me.login, me.name);
    };
    beat();
    const t = window.setInterval(beat, 45_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [backend, me, accepted]);

  // Files that were chosen offline go up as soon as there's a connection.
  useEffect(() => {
    if (!me) return;
    const run = () => void processOutbox(backend);
    run();
    window.addEventListener("online", run);
    const t = window.setInterval(run, 30_000);
    return () => {
      window.removeEventListener("online", run);
      window.clearInterval(t);
    };
  }, [backend, me]);

  // This device's notification address can change; keep it current once allowed.
  useEffect(() => {
    if (!me || !useLiveData || IS_DEMO_BUILD) return;
    setPush(currentPushState());
    if (currentPushState() === "on") {
      void enablePush(false).then((r) => {
        if (r.token) backend.saveState(me.login, { addToken: r.token });
      });
    }
  }, [backend, me]);

  const markRead = useCallback(
    (roomId: string) => {
      if (login) backend.saveState(login, { reads: { [roomId]: Date.now() } });
    },
    [backend, login],
  );

  // Pop-up (and, if the tab is in the background, a system notification) for new messages in other rooms.
  const lastSeen = useRef<Map<string, number> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeRef = useRef(activeRoomId);
  activeRef.current = activeRoomId;
  useEffect(() => {
    if (!me || !roomsReady || !stateReady) return;
    const prev = lastSeen.current;
    const next = new Map(rooms.map((r) => [r.id, r.lastMessageAt ?? 0]));
    lastSeen.current = next;
    if (!prev || stateRef.current.noticeAcceptedAt === undefined) return;
    for (const r of rooms) {
      const before = prev.get(r.id);
      if (before === undefined || !r.lastMessageAt || r.lastMessageAt <= before) continue;
      if (r.lastMessageBy === me.login) continue;
      const looking = activeRef.current === r.id && document.visibilityState === "visible";
      if (looking) continue;
      const mentioned = wasMentioned(r, stateRef.current, me.login);
      if (stateRef.current.muted[r.id] && !mentioned) continue;
      const who = personDisplayName(r.lastMessageBy);
      const title = r.kind === "dm" ? who : `${who} · ${r.name}`;
      const body = r.lastMessageText || "New message";
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body, tag: r.id, icon: "/app/icon-192.png" });
        } catch {
          /* some browsers only allow notifications from the service worker */
        }
      } else {
        toast(`${mentioned ? "@ " : ""}${title}: ${body}`, "info");
      }
    }
  }, [me, rooms, roomsReady, stateReady]);

  const badge = useMemo(() => (me ? badgeRooms(rooms.filter((r) => isMember(r, me.login)), state, me.login) : 0), [rooms, state, me]);

  const acceptNotice = useCallback(() => {
    if (login) backend.saveState(login, { noticeAcceptedAt: Date.now() });
  }, [backend, login]);

  const setMuted = useCallback(
    (roomId: string, muted: boolean) => {
      if (login) backend.saveState(login, { muted: { [roomId]: muted } });
    },
    [backend, login],
  );

  const openDm = useCallback(
    async (other: string) => {
      if (!me) throw new Error("not signed in");
      const id = dmRoomId(me.login, other);
      if (!rooms.some((r) => r.id === id)) {
        await backend.createRoom({
          id,
          kind: "dm",
          name: "Direct message",
          audience: "list",
          memberLogins: [me.login, other.toLowerCase()],
          createdBy: me.login,
          createdAt: Date.now(),
        });
      }
      return id;
    },
    [backend, me, rooms],
  );

  const createGroup = useCallback(
    async (name: string, logins: string[]) => {
      if (!me) throw new Error("not signed in");
      const id = newId("g_");
      await backend.createRoom({
        id,
        kind: "group",
        name: name.trim().slice(0, 60) || "New group",
        audience: "list",
        memberLogins: [...new Set([me.login, ...logins.map((l) => l.toLowerCase())])],
        createdBy: me.login,
        createdAt: Date.now(),
      });
      return id;
    },
    [backend, me],
  );

  const turnOnNotifications = useCallback(async () => {
    if (!me) return undefined;
    const r = await enablePush(true);
    setPush(r.state);
    if (r.token) backend.saveState(me.login, { addToken: r.token });
    return r.message;
  }, [backend, me]);

  const value = useMemo<ChatContextValue>(
    () => ({
      enabled,
      me,
      backend,
      rooms,
      roomsReady,
      state,
      stateReady,
      people,
      presence,
      badge,
      activeRoomId,
      setActiveRoomId,
      markRead,
      acceptNotice,
      setMuted,
      openDm,
      createGroup,
      push,
      turnOnNotifications,
    }),
    [enabled, me, backend, rooms, roomsReady, state, stateReady, people, presence, badge, activeRoomId, markRead, acceptNotice, setMuted, openDm, createGroup, push, turnOnNotifications],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
