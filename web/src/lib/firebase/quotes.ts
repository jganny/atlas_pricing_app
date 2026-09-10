"use client";

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import type { EnquiryRecord } from "@/lib/types";
import {
  mapQuoteDocsSafely,
  mergeEnquiryRows,
} from "@/lib/quotes/map-saved-quote";
import { getFirebaseDb } from "./client";

export { mapQuoteFromSaved, mapStatus } from "@/lib/quotes/map-saved-quote";

/** Recent quotes for Enquiry DB. Won jobs are merged from a dedicated query. */
export const LIVE_ENQUIRY_LIMIT = 1200;
export const WON_ENQUIRY_LIMIT = 600;

function recentQuery(max: number): Query {
  const db = getFirebaseDb();
  return query(collection(db, "quotes"), orderBy("timestamp", "desc"), limit(max));
}

function recentFallbackQuery(max: number): Query {
  const db = getFirebaseDb();
  return query(collection(db, "quotes"), limit(max));
}

function statusQuery(status: string, max: number): Query {
  const db = getFirebaseDb();
  return query(collection(db, "quotes"), where("status", "==", status), limit(max));
}

async function getMapped(q: Query): Promise<EnquiryRecord[]> {
  const snap = await getDocs(q);
  return mapQuoteDocsSafely(snap.docs);
}

async function fetchRecentQuotes(max: number): Promise<EnquiryRecord[]> {
  try {
    return await getMapped(recentQuery(max));
  } catch (err) {
    console.warn("Quotes timestamp query failed, using unordered fallback:", err);
    return await getMapped(recentFallbackQuery(max));
  }
}

async function fetchStatusQuotes(status: string, max: number): Promise<EnquiryRecord[]> {
  try {
    return await getMapped(statusQuery(status, max));
  } catch (err) {
    console.warn(`Quotes status=${status} query failed:`, err);
    return [];
  }
}

export async function fetchLiveEnquiries(max = LIVE_ENQUIRY_LIMIT): Promise<EnquiryRecord[]> {
  const [recent, converted, won] = await Promise.all([
    fetchRecentQuotes(max),
    fetchStatusQuotes("converted", WON_ENQUIRY_LIMIT),
    fetchStatusQuotes("won", WON_ENQUIRY_LIMIT),
  ]);
  return mergeEnquiryRows(recent, converted, won);
}

function listen(
  q: Query,
  onRows: (rows: EnquiryRecord[]) => void,
  onError?: (err: Error) => void,
  fallback?: Query,
): Unsubscribe {
  let active: Unsubscribe | null = null;
  const attach = (target: Query, allowFallback: boolean) => {
    active = onSnapshot(
      target,
      (snap) => onRows(mapQuoteDocsSafely(snap.docs)),
      (err) => {
        if (allowFallback && fallback) {
          active?.();
          attach(fallback, false);
          return;
        }
        onError?.(err);
      },
    );
  };
  attach(q, Boolean(fallback));
  return () => active?.();
}

/** Real-time subscription — live enquiry list without manual refresh. */
export function subscribeLiveEnquiries(
  onData: (rows: EnquiryRecord[]) => void,
  onError?: (err: Error) => void,
  max = LIVE_ENQUIRY_LIMIT,
): () => void {
  let recent: EnquiryRecord[] = [];
  let converted: EnquiryRecord[] = [];
  let won: EnquiryRecord[] = [];
  const emit = () => onData(mergeEnquiryRows(recent, converted, won));

  const unsubs = [
    listen(
      recentQuery(max),
      (rows) => {
        recent = rows;
        emit();
      },
      onError,
      recentFallbackQuery(max),
    ),
    listen(
      statusQuery("converted", WON_ENQUIRY_LIMIT),
      (rows) => {
        converted = rows;
        emit();
      },
    ),
    listen(
      statusQuery("won", WON_ENQUIRY_LIMIT),
      (rows) => {
        won = rows;
        emit();
      },
    ),
  ];

  return () => unsubs.forEach((u) => u());
}
