"use client";

import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  applyRemoteNrsAlerts,
  applyRemoteNrsFollowUps,
  setNrsMirror,
  type NrsAlert,
  type NrsFollowUp,
} from "@/lib/quotes/nrs-alerts";
import { getFirebaseDb } from "./client";

const FOLLOWUPS = "nrs_followups";
const ALERTS = "nrs_alerts";

/** Firestore rejects `undefined` fields, so drop them before saving. */
function clean<T extends object>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

/**
 * Shares the NRS desk's follow-ups and alerts with everyone, instead of leaving
 * them in whichever browser created them. They are stored by desk, never by
 * person, so the queue stays put when the seat changes hands.
 */
export function startNrsDeskSync(): () => void {
  const db = getFirebaseDb();
  const warn = (what: string) => (err: Error) => console.warn(`NRS ${what} sync:`, err.message);

  setNrsMirror({
    saveFollowUp: (row) => void setDoc(doc(db, FOLLOWUPS, row.id), clean(row)).catch(warn("follow-up save")),
    removeFollowUp: (id) => void deleteDoc(doc(db, FOLLOWUPS, id)).catch(warn("follow-up remove")),
    saveAlert: (row) => void setDoc(doc(db, ALERTS, row.id), clean(row)).catch(warn("alert save")),
  });

  const offFollowUps = onSnapshot(
    collection(db, FOLLOWUPS),
    (snap) => applyRemoteNrsFollowUps(snap.docs.map((d) => d.data() as NrsFollowUp)),
    warn("follow-ups"),
  );
  const offAlerts = onSnapshot(
    collection(db, ALERTS),
    (snap) => applyRemoteNrsAlerts(snap.docs.map((d) => d.data() as NrsAlert)),
    warn("alerts"),
  );

  return () => {
    offFollowUps();
    offAlerts();
    setNrsMirror(null);
  };
}
