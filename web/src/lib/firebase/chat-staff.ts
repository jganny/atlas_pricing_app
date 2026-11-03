"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";

export type StaffState = "ready" | "invited" | "joined" | "off";

export interface StaffListRow {
  username: string;
  name: string;
  addedAt: number;
  joinedAt: number;
  state: StaffState;
}

export interface CreateResult {
  name: string;
  username: string;
  ok: boolean;
  reason?: string;
  link?: string;
}

const call = <I, O>(name: string) => httpsCallable<I, O>(getFunctions(getFirebaseApp()), name);

export async function createChatStaff(people: Array<{ name: string; username: string }>): Promise<CreateResult[]> {
  return (await call<{ people: typeof people }, { results: CreateResult[] }>("chatStaffCreate")({ people })).data.results;
}
export async function listChatStaff(): Promise<StaffListRow[]> {
  return (await call<unknown, { rows: StaffListRow[] }>("chatStaffList")({})).data.rows;
}
export async function newChatStaffLink(username: string): Promise<string> {
  return (await call<{ username: string }, { link: string }>("chatStaffInvite")({ username })).data.link;
}
export async function setChatStaffActive(username: string, active: boolean): Promise<void> {
  await call<{ username: string; active: boolean }, { ok: boolean }>("chatStaffSetActive")({ username, active });
}
/** The person opening their link chooses a password. Public: no sign-in needed. */
export async function redeemChatInvite(token: string, password: string): Promise<string> {
  return (await call<{ token: string; password: string }, { username: string }>("chatInviteRedeem")({ token, password })).data.username;
}
