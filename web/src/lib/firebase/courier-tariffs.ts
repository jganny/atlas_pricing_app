"use client";

import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "./client";
import type { CourierTariffBook } from "@/lib/quotes/courier-tariff";

function mapBook(id: string, data: Record<string, unknown>): CourierTariffBook | null {
  const lanes = data.lanes;
  if (!Array.isArray(lanes)) return null;
  return {
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
    fileName: data.fileName ? String(data.fileName) : undefined,
    uploadedAt: String(data.uploadedAt ?? data.createdAt ?? ""),
  };
}

export async function fetchCourierTariffBooks(): Promise<CourierTariffBook[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "courier_tariff_books"));
  return snap.docs
    .map((d) => mapBook(d.id, d.data() as Record<string, unknown>))
    .filter((b): b is CourierTariffBook => Boolean(b?.lanes?.length));
}

export async function publishCourierTariffBook(
  book: CourierTariffBook,
  uploadedBy: string,
): Promise<string> {
  const db = getFirebaseDb();
  const ref = await addDoc(collection(db, "courier_tariff_books"), {
    carrier: book.carrier,
    carrierCode: book.carrierCode,
    carrierId: book.carrierId,
    year: book.year,
    validFrom: book.validFrom,
    validTo: book.validTo,
    currency: book.currency,
    maxKg: book.maxKg,
    lanes: book.lanes,
    fileName: book.fileName || "",
    uploadedAt: book.uploadedAt,
    uploadedBy,
    published: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
