/** Who can be messaged, and which desk channels exist right now. Follows desk seats, not fixed people. */
import {
  DESK_SEATS,
  OWNED_DESK_SEATS,
  activeSeatForLogin,
  isDisplacedLogin,
  listOccupants,
  personDisplayName,
  seatForLogin,
} from "@/lib/auth/desk-seats";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import { EVERYONE_ROOM, deskRoomId } from "./chat-logic";
import type { ChatRoom, Person } from "./types";

/** Every login that is a current colleague: known team accounts plus whoever sits in a desk seat. */
export function listPeople(): Person[] {
  const logins = new Set<string>(Object.keys(TEAM_ROLES));
  listOccupants().forEach((o) => logins.add(o.loginId.toLowerCase()));
  return [...logins]
    .filter((l) => !isDisplacedLogin(l))
    .map((login) => ({ login, name: personDisplayName(login), desk: seatForLogin(login)?.label }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The logins who currently hold a desk — not people who held it before. */
export function currentSeatLogins(seatId: string): string[] {
  const seat = DESK_SEATS.find((s) => s.id === seatId);
  const candidates = new Set<string>(seat?.defaultLoginIds ?? []);
  listOccupants()
    .filter((o) => o.seatId === seatId)
    .forEach((o) => candidates.add(o.loginId.toLowerCase()));
  return [...candidates].filter((l) => activeSeatForLogin(l)?.id === seatId).sort();
}

/** Everyone, plus one channel per desk that owns data. */
export function desiredChannels(now = Date.now()): ChatRoom[] {
  const base = { kind: "channel" as const, createdBy: "system", createdAt: now };
  const rooms: ChatRoom[] = [{ ...base, id: EVERYONE_ROOM, name: "Everyone", audience: "all", memberLogins: [] }];
  for (const seatId of OWNED_DESK_SEATS) {
    const seat = DESK_SEATS.find((s) => s.id === seatId);
    if (!seat) continue;
    rooms.push({ ...base, id: deskRoomId(seatId), name: seat.label, audience: "list", memberLogins: currentSeatLogins(seatId), seatId });
  }
  return rooms;
}

/** Only the channels whose name or members differ from what's stored (or that don't exist yet). */
export function channelsToSync(existing: ChatRoom[], wanted: ChatRoom[]): ChatRoom[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  return wanted.filter((w) => {
    const cur = byId.get(w.id);
    if (!cur) return true;
    return cur.name !== w.name || [...cur.memberLogins].sort().join() !== [...w.memberLogins].sort().join();
  });
}
