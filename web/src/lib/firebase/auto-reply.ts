"use client";

import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseDb } from "./client";

export type BranchTeam = { branch: string; stations: string[]; emails: string[] };

export type AutoReplySettings = {
  ackEnquiry: boolean;
  ackConfirmation: boolean;
  /** While set, every automatic message goes to this one address instead of the real recipients. */
  testRedirect: string;
  dailyCap: number;
  nrsDesk: string;
  branchTeams: BranchTeam[];
};

export const DEFAULT_AUTO_REPLY: AutoReplySettings = { ackEnquiry: false, ackConfirmation: false, testRedirect: "", dailyCap: 150, nrsDesk: "NRS Desk", branchTeams: [] };

export type AckLogRow = { id: string; at: number; mailbox: string; kind: string; to: string; wouldGoTo: string; cc: string[]; subject: string; attachments: number; status: string; error: string; test: boolean };

export async function fetchAutoReplySettings(): Promise<AutoReplySettings> {
  const snap = await getDoc(doc(getFirebaseDb(), "inboxAutoReply", "settings"));
  const v = snap.exists() ? (snap.data() as Partial<AutoReplySettings>) : {};
  return {
    ...DEFAULT_AUTO_REPLY,
    ...v,
    branchTeams: Array.isArray(v.branchTeams) ? v.branchTeams.map((t) => ({ branch: String(t.branch ?? ""), stations: Array.isArray(t.stations) ? t.stations.map(String) : [], emails: Array.isArray(t.emails) ? t.emails.map(String) : [] })) : [],
  };
}

export async function saveAutoReplySettings(s: AutoReplySettings): Promise<void> {
  await setDoc(doc(getFirebaseDb(), "inboxAutoReply", "settings"), JSON.parse(JSON.stringify(s)));
}

export async function fetchAckLog(): Promise<AckLogRow[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), "inbox_ack_log"), orderBy("at", "desc"), limit(30)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AckLogRow, "id">) }));
}

/** Admin: sends two sample messages (an enquiry acknowledgement and a confirmation acknowledgement) to ONE address. */
export async function sendAutoReplyTest(to: string, mailbox: "pricing" | "pricingsales"): Promise<{ from: string }> {
  const call = httpsCallable<{ to: string; mailbox: string }, { ok: boolean; sent: number; from: string }>(getFunctions(getFirebaseApp(), "us-central1"), "autoReplyTest", { timeout: 90_000 });
  const res = await call({ to, mailbox });
  return { from: res.data.from };
}
