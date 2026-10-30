"use client";

import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { useLiveData } from "@/lib/api";
import { DRAFT_MODES, type DraftMode, type DraftRow } from "@/lib/quotes/drafts";
import { getFirebaseDb } from "./client";

/**
 * Where drafts live. Signed in to the live app: the `quoteDrafts` collection, so a draft follows the desk to any
 * computer. Demo / offline: this browser only. The desk's state travels as one JSON string, so nothing in it can
 * trip Firestore's rules about empty values or nesting.
 */
const LOCAL_KEY = "atlas_drafts_v1";
const listeners = new Set<() => void>();

function readLocal(): DraftRow[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(raw) ? (raw as DraftRow[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: DraftRow[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 100)));
  } catch {
    /* quota */
  }
  listeners.forEach((fn) => fn());
}

function toDoc(row: DraftRow) {
  const { quote, ...rest } = row;
  return { ...rest, quoteJson: JSON.stringify(quote) };
}

function fromDoc(id: string, x: Record<string, unknown>): DraftRow | null {
  try {
    return {
      id,
      mode: DRAFT_MODES.includes(x.mode as DraftMode) ? (x.mode as DraftMode) : "air",
      seat: String(x.seat ?? ""),
      creator: String(x.creator ?? ""),
      customer: String(x.customer ?? ""),
      route: String(x.route ?? ""),
      waitingFor: String(x.waitingFor ?? ""),
      step: String(x.step ?? "shipment"),
      savedAt: Number(x.savedAt ?? 0),
      quote: JSON.parse(String(x.quoteJson ?? "{}")),
    };
  } catch {
    return null;
  }
}

export function newDraftId(): string {
  return `D${Math.random().toString(36).slice(2, 11)}`;
}

export async function saveDraft(row: DraftRow): Promise<void> {
  if (!useLiveData) {
    writeLocal([row, ...readLocal().filter((r) => r.id !== row.id)]);
    return;
  }
  await setDoc(doc(getFirebaseDb(), "quoteDrafts", row.id), toDoc(row));
}

export async function deleteDraft(id: string): Promise<void> {
  if (!useLiveData) {
    writeLocal(readLocal().filter((r) => r.id !== id));
    return;
  }
  await deleteDoc(doc(getFirebaseDb(), "quoteDrafts", id));
}

export async function fetchDraft(id: string): Promise<DraftRow | null> {
  if (!useLiveData) return readLocal().find((r) => r.id === id) ?? null;
  const snap = await getDoc(doc(getFirebaseDb(), "quoteDrafts", id));
  return snap.exists() ? fromDoc(snap.id, snap.data() as Record<string, unknown>) : null;
}

export function subscribeDrafts(onData: (rows: DraftRow[]) => void): () => void {
  if (!useLiveData) {
    const push = () => onData(readLocal());
    listeners.add(push);
    push();
    return () => void listeners.delete(push);
  }
  return onSnapshot(
    collection(getFirebaseDb(), "quoteDrafts"),
    (snap) => onData(snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>)).filter((r): r is DraftRow => !!r)),
    () => onData([]),
  );
}
