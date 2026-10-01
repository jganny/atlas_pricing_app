"use client";

import { collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { WonFollowUpValues } from "@/lib/quotes/won-followups";
import { getFirebaseDb } from "./client";

/**
 * One row per Won quote, keyed by quoteId — tracks whatever shipper/
 * consignee/commodity/buy/sell details were still blank at conversion.
 * Never deleted once a field fills in: the row just stops showing as
 * pending (missingWonFields(row) goes empty), so there's always a record
 * of what was captured and when.
 */
export interface WonFollowUpRow extends WonFollowUpValues {
  id: string;
  quoteId: string;
  ref: string;
  customer: string;
  wonAt: string;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fromDoc(id: string, x: Record<string, unknown>): WonFollowUpRow {
  return {
    id,
    quoteId: String(x.quoteId ?? id),
    ref: String(x.ref ?? ""),
    customer: String(x.customer ?? ""),
    wonAt: String(x.wonAt ?? ""),
    shipperName: String(x.shipperName ?? ""),
    consigneeName: String(x.consigneeName ?? ""),
    commodity: String(x.commodity ?? ""),
    buyRate: num(x.buyRate),
    sellAmount: num(x.sellAmount),
  };
}

export async function fetchWonFollowUps(): Promise<WonFollowUpRow[]> {
  const snap = await getDocs(collection(getFirebaseDb(), "wonFollowUps"));
  return snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>));
}

export function subscribeWonFollowUps(
  onData: (rows: WonFollowUpRow[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), "wonFollowUps"),
    (snap) => onData(snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  );
}

/** Creates or updates a quote's follow-up row. Merge, so filling in one
 * field from the worklist never clobbers the others. */
export async function upsertWonFollowUp(
  row: { quoteId: string; ref: string; customer: string; wonAt?: string } & Partial<WonFollowUpValues>,
  updatedBy: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    quoteId: row.quoteId,
    ref: row.ref,
    customer: row.customer,
    updatedBy,
    updatedAt: serverTimestamp(),
  };
  if (row.wonAt) patch.wonAt = row.wonAt;
  if (row.shipperName !== undefined) patch.shipperName = row.shipperName;
  if (row.consigneeName !== undefined) patch.consigneeName = row.consigneeName;
  if (row.commodity !== undefined) patch.commodity = row.commodity;
  if (row.buyRate !== undefined) patch.buyRate = row.buyRate;
  if (row.sellAmount !== undefined) patch.sellAmount = row.sellAmount;
  await setDoc(doc(getFirebaseDb(), "wonFollowUps", row.quoteId), patch, { merge: true });
}
