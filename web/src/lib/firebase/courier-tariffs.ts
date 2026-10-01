"use client";

import { addDoc, collection, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "./client";
import {
  dedupeCourierTariffBooks,
  repairCourierTariffBook,
  type CourierTariffBook,
} from "@/lib/quotes/courier-tariff";

function bookIdentity(book: { carrierId?: string; year?: number; lanes?: Array<{ direction: string }>; fileName?: string }) {
  const dirs = [...new Set((book.lanes || []).map((l) => l.direction))].sort().join("+");
  const file = String(book.fileName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${String(book.carrierId || "fedex").toLowerCase()}::${book.year || ""}::${dirs}::${file}`;
}

function mapBook(id: string, data: Record<string, unknown>): CourierTariffBook | null {
  const lanes = data.lanes;
  if (!Array.isArray(lanes)) return null;
  return repairCourierTariffBook({
    id,
    carrier: String(data.carrier ?? "FedEx"),
    carrierCode: String(data.carrierCode ?? "FDX"),
    carrierId: String(data.carrierId ?? "fedex"),
    year: Number(data.year) || new Date().getFullYear(),
    validFrom: String(data.validFrom ?? ""),
    validTo: String(data.validTo ?? ""),
    currency: String(data.currency ?? "INR"),
    maxKg: Number(data.maxKg) || 70,
    lanes: lanes as CourierTariffBook["lanes"],
    zoneMap:
      data.zoneMap && typeof data.zoneMap === "object" && !Array.isArray(data.zoneMap)
        ? (data.zoneMap as Record<string, string>)
        : undefined,
    fileName: data.fileName ? String(data.fileName) : undefined,
    uploadedAt: String(data.uploadedAt ?? data.createdAt ?? ""),
  });
}

export async function fetchCourierTariffBooks(): Promise<CourierTariffBook[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "courier_tariff_books"));
  return dedupeCourierTariffBooks(
    snap.docs.map((d) => mapBook(d.id, d.data() as Record<string, unknown>)).filter((b): b is CourierTariffBook => Boolean(b?.lanes?.length)),
  );
}

export async function publishCourierTariffBook(
  book: CourierTariffBook,
  uploadedBy: string,
): Promise<string> {
  const db = getFirebaseDb();
  const identity = bookIdentity(book);
  const snap = await getDocs(collection(db, "courier_tariff_books"));
  for (const row of snap.docs) {
    const data = row.data() as Record<string, unknown>;
    const existing = mapBook(row.id, data);
    if (!existing) continue;
    if (bookIdentity(existing) === identity || (book.fileName && existing.fileName === book.fileName)) {
      await deleteDoc(row.ref);
    }
  }
  const repaired = repairCourierTariffBook(book);
  const ref = await addDoc(collection(db, "courier_tariff_books"), {
    carrier: repaired.carrier,
    carrierCode: repaired.carrierCode,
    carrierId: repaired.carrierId,
    year: repaired.year,
    validFrom: repaired.validFrom,
    validTo: repaired.validTo,
    currency: repaired.currency,
    maxKg: repaired.maxKg,
    lanes: repaired.lanes,
    zoneMap: repaired.zoneMap || {},
    fileName: repaired.fileName || "",
    uploadedAt: repaired.uploadedAt,
    uploadedBy,
    published: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
