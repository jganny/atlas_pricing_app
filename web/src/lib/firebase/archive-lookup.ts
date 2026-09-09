"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { getFirebaseDb } from "./client";
import { mapQuoteFromSaved } from "./quotes";

export interface ArchiveLookupResult {
  source: "live" | "archive";
  quote: SavedQuote;
  row: EnquiryRecord;
}

function normalizeRef(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

async function tryDoc(collectionName: string, id: string): Promise<SavedQuote | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SavedQuote, "id">) };
}

async function tryWhere(
  collectionName: string,
  field: string,
  value: string | number,
): Promise<SavedQuote | null> {
  const db = getFirebaseDb();
  const q = query(collection(db, collectionName), where(field, "==", value), limit(5));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const first = snap.docs[0];
  return { id: first.id, ...(first.data() as Omit<SavedQuote, "id">) };
}

function matchesRef(quote: SavedQuote, needle: string): boolean {
  const ref = normalizeRef(getQuoteRefId(quote));
  const id = normalizeRef(quote.id || "");
  const qn = normalizeRef(String(quote.quoteNumber ?? ""));
  const qref = normalizeRef(String(quote.quoteRefNo ?? ""));
  return (
    ref === needle ||
    id === needle ||
    qn === needle ||
    qref === needle ||
    ref.includes(needle) ||
    needle.includes(ref)
  );
}

/**
 * Find a quote by ref / id in live `quotes` then `archive_quotes`
 * (legacy lookupSingleArchivedQuote parity — read path only).
 */
export async function lookupQuoteByRef(raw: string): Promise<ArchiveLookupResult | null> {
  const needle = normalizeRef(raw);
  if (!needle) return null;

  const collections: Array<"quotes" | "archive_quotes"> = ["quotes", "archive_quotes"];

  for (const col of collections) {
    const byId = await tryDoc(col, raw.trim());
    if (byId) {
      return {
        source: col === "quotes" ? "live" : "archive",
        quote: byId,
        row: mapQuoteFromSaved(byId.id, byId),
      };
    }

    const numMatch = needle.match(/(\d{4,})$/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      for (const value of [n, String(n)] as const) {
        const hit = await tryWhere(col, "quoteNumber", value);
        if (hit) {
          return {
            source: col === "quotes" ? "live" : "archive",
            quote: hit,
            row: mapQuoteFromSaved(hit.id, hit),
          };
        }
      }
    }

    const byRefNo = await tryWhere(col, "quoteRefNo", raw.trim());
    if (byRefNo) {
      return {
        source: col === "quotes" ? "live" : "archive",
        quote: byRefNo,
        row: mapQuoteFromSaved(byRefNo.id, byRefNo),
      };
    }
  }

  const db = getFirebaseDb();
  const liveSnap = await getDocs(query(collection(db, "quotes"), limit(200)));
  for (const d of liveSnap.docs) {
    const data = { id: d.id, ...(d.data() as Omit<SavedQuote, "id">) };
    if (matchesRef(data, needle)) {
      return { source: "live", quote: data, row: mapQuoteFromSaved(d.id, data) };
    }
  }

  try {
    const archSnap = await getDocs(query(collection(db, "archive_quotes"), limit(100)));
    for (const d of archSnap.docs) {
      const data = { id: d.id, ...(d.data() as Omit<SavedQuote, "id">) };
      if (matchesRef(data, needle)) {
        return { source: "archive", quote: data, row: mapQuoteFromSaved(d.id, data) };
      }
    }
  } catch {
    // archive_quotes may be missing / blocked by rules
  }

  return null;
}

function quoteHay(quote: SavedQuote): string {
  const d = quote.details || {};
  return [
    quote.customer,
    quote.route,
    quote.routingDetails,
    quote.creator,
    quote.quoteRefNo,
    quote.quoteNumber,
    d.origin,
    d.destination,
    d.airline,
    d.shippingLine,
    d.carrier,
  ]
    .map((v) => String(v ?? ""))
    .join(" ")
    .toLowerCase();
}

function matchesText(quote: SavedQuote, raw: string): boolean {
  const tokens = raw
    .toLowerCase()
    .trim()
    .split(/[\s,/|→\-]+/)
    .filter((t) => t.length >= 2);
  if (!tokens.length) return false;
  const hay = quoteHay(quote);
  return tokens.every((t) => hay.includes(t));
}

/** Find quotes by customer, city, lane, or carrier — filename not required. */
export async function lookupQuotesByText(raw: string): Promise<ArchiveLookupResult[]> {
  const q = raw.trim();
  if (q.length < 2) return [];
  const db = getFirebaseDb();
  const hits: ArchiveLookupResult[] = [];
  const seen = new Set<string>();

  const exact = await lookupQuoteByRef(q);
  if (exact) {
    seen.add(exact.quote.id);
    hits.push(exact);
  }

  const liveSnap = await getDocs(query(collection(db, "quotes"), limit(400)));
  for (const d of liveSnap.docs) {
    if (seen.has(d.id)) continue;
    const data = { id: d.id, ...(d.data() as Omit<SavedQuote, "id">) };
    if (matchesText(data, q)) {
      seen.add(d.id);
      hits.push({ source: "live", quote: data, row: mapQuoteFromSaved(d.id, data) });
    }
    if (hits.length >= 12) return hits;
  }

  try {
    const archSnap = await getDocs(query(collection(db, "archive_quotes"), limit(200)));
    for (const d of archSnap.docs) {
      if (seen.has(d.id)) continue;
      const data = { id: d.id, ...(d.data() as Omit<SavedQuote, "id">) };
      if (matchesText(data, q)) {
        seen.add(d.id);
        hits.push({ source: "archive", quote: data, row: mapQuoteFromSaved(d.id, data) });
      }
      if (hits.length >= 12) return hits;
    }
  } catch {
    /* archive_quotes may be missing */
  }

  return hits;
}
