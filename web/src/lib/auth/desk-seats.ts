/**
 * Stable desk seats vs people.
 * Seats (Air Nom, Sea Nom, NRS, Free Hand, …) stay. Occupants can be swapped.
 */

import { IS_DEMO_BUILD } from "@/lib/demo-mode";
import { REAL_SEAT_LABELS, REAL_PERSON_NAMES } from "@/lib/auth/desk-seats-real-names";

export type DeskSeatId =
  | "admin"
  | "manager"
  | "air-nom"
  | "sea-nom"
  | "nrs"
  | "freehand"
  | "pricing";

export interface DeskSeat {
  id: DeskSeatId;
  label: string;
  blurb: string;
  /** Canonical login ids that historically own this seat. */
  defaultLoginIds: string[];
}

interface SeatShape {
  id: DeskSeatId;
  blurb: string;
  defaultLoginIds: string[];
}

const SEAT_SHAPES: SeatShape[] = [
  { id: "admin", blurb: "Full workspace", defaultLoginIds: ["ganny"] },
  { id: "manager", blurb: "Approvals & reports", defaultLoginIds: ["manager"] },
  { id: "air-nom", blurb: "Air nomination desk", defaultLoginIds: ["shashank"] },
  { id: "sea-nom", blurb: "Sea nomination desk", defaultLoginIds: ["shaheer"] },
  { id: "nrs", blurb: IS_DEMO_BUILD ? "Priority follow-ups" : "Nomination / NRS", defaultLoginIds: ["cathrina"] },
  { id: "freehand", blurb: IS_DEMO_BUILD ? "Independent air & sea sales" : "Free-hand air & sea", defaultLoginIds: ["kavya", "jaya"] },
  { id: "pricing", blurb: "Shared quoting login", defaultLoginIds: ["pricing"] },
];

// Real labels live in the sibling desk-seats-real-names.ts file, which
// scripts/build-demo.sh physically replaces with a demo-safe stub before
// compiling — so the demo build never has the real labels in its source at
// all, not just unreferenced at runtime (see that file for why).
const DEMO_SEAT_LABELS: Record<DeskSeatId, string> = {
  admin: "Admin",
  manager: "Manager",
  "air-nom": "Air Desk",
  "sea-nom": "Sea Desk",
  nrs: "Priority Desk",
  freehand: "Independent Sales",
  pricing: "Pricing Agent",
};

const SEAT_LABELS: Record<DeskSeatId, string> = IS_DEMO_BUILD ? DEMO_SEAT_LABELS : REAL_SEAT_LABELS;

export const DESK_SEATS: DeskSeat[] = SEAT_SHAPES.map((s) => ({ ...s, label: SEAT_LABELS[s.id] }));

// Same source-level split for the generic "turn any login id into a shown
// name" fallback personDisplayName() uses below when no occupant overrides it.
const DEMO_PERSON_NAMES: Record<string, string> = {
  ganny: "Admin",
  manager: "Manager",
  shashank: "Air Desk",
  shaheer: "Sea Desk",
  kavya: "Sales Rep",
  jaya: "Sales Rep",
  cathrina: "Priority Desk",
  pricing: "Pricing Agent",
  sunil: "Sales Rep A",
  ramesh: "Sales Rep B",
  goutham: "Sales Rep C",
  spoorthi: "Sales Rep D",
  linson: "Sales Rep E",
};

const PERSON_NAMES: Record<string, string> = IS_DEMO_BUILD ? DEMO_PERSON_NAMES : REAL_PERSON_NAMES;
const DEMO_FALLBACK_NAME = "Team Member";

export interface SeatOccupant {
  seatId: DeskSeatId;
  loginId: string;
  personName: string;
}

const STORAGE_KEY = "atlas_desk_occupants_v1";

function titleCase(value: string): string {
  if (!value) return "";
  return value
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function personDisplayName(loginId: string | undefined | null, fallback?: string): string {
  if (!loginId) return fallback || "—";
  const occ = listOccupants().find((o) => o.loginId.toLowerCase() === loginId.toLowerCase());
  if (occ?.personName) return IS_DEMO_BUILD ? DEMO_FALLBACK_NAME : occ.personName;
  if (fallback && fallback !== loginId) return fallback;
  return PERSON_NAMES[loginId.toLowerCase()] ?? (IS_DEMO_BUILD ? DEMO_FALLBACK_NAME : titleCase(loginId));
}

export function seatForLogin(loginId: string | undefined | null): DeskSeat | null {
  if (!loginId) return null;
  const id = loginId.toLowerCase();
  const assigned = listOccupants().find((o) => o.loginId.toLowerCase() === id);
  if (assigned) return DESK_SEATS.find((s) => s.id === assigned.seatId) || null;
  return DESK_SEATS.find((s) => s.defaultLoginIds.includes(id)) || null;
}

export function occupantLoginForSeat(seatId: DeskSeatId): string {
  const assigned = listOccupants().find((o) => o.seatId === seatId);
  if (assigned?.loginId) return assigned.loginId;
  return DESK_SEATS.find((s) => s.id === seatId)?.defaultLoginIds[0] || seatId;
}

let cache: SeatOccupant[] | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function listOccupants(): SeatOccupant[] {
  if (typeof window === "undefined") return [];
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SeatOccupant[];
    cache = Array.isArray(raw) ? raw : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function saveOccupants(rows: SeatOccupant[]): void {
  cache = rows;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* private mode — the in-memory copy still works */
  }
  emit();
}

/** Applies the shared (Firestore) seat list; returns true when it actually changed anything. */
export function applyRemoteOccupants(rows: SeatOccupant[]): boolean {
  const norm = (r: SeatOccupant[]) =>
    JSON.stringify([...r].sort((a, b) => a.seatId.localeCompare(b.seatId)).map((o) => [o.seatId, o.loginId.toLowerCase(), o.personName]));
  if (norm(rows) === norm(listOccupants())) return false;
  saveOccupants(rows);
  return true;
}

/** For useSyncExternalStore — lets name-displaying components re-render when seats change. */
export function subscribeSeats(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getSeatsVersion(): number {
  return version;
}

export function upsertOccupant(next: SeatOccupant): void {
  const rows = listOccupants().filter(
    (r) => r.seatId !== next.seatId && r.loginId.toLowerCase() !== next.loginId.toLowerCase(),
  );
  rows.push(next);
  saveOccupants(rows);
}

export function removeOccupant(seatId: DeskSeatId): void {
  saveOccupants(listOccupants().filter((r) => r.seatId !== seatId));
}

/** Person name, with seat when assigned (e.g. “Goutham · Air Nom”). */
export function signedInCaption(loginId: string | undefined | null, displayName?: string): string {
  const person = personDisplayName(loginId, displayName);
  const seat = seatForLogin(loginId);
  if (seat && person.toLowerCase() !== seat.label.toLowerCase()) {
    return `${person} · ${seat.label}`;
  }
  return person;
}

export function enquiryAssigneeLabel(creator: string | undefined | null): string {
  return signedInCaption(creator);
}
