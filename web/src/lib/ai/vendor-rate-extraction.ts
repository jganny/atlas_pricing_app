"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/client";
import { ExtractionError } from "@/lib/ai/circular-extraction";

const MAX_FILE_BYTES = 6 * 1024 * 1024;

interface ExtractedRateBase {
  currency: string;
  validity: string;
  confidence: "high" | "needs_check";
  note: string;
}

export interface ExtractedTransportRate extends ExtractedRateBase {
  deskType: "transport";
  vendorName: string;
  origin: string;
  destination: string;
  freightBuy: number | null;
  detention: number | null;
  tolls: number | null;
}

export interface ExtractedWarehouseRate extends ExtractedRateBase {
  deskType: "warehouse";
  location: string;
  ratePerCbm: number | null;
  handling: number | null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/** Reads a one-off vendor rate sheet (PDF) the desk just picked and returns the
 * extracted numbers — nothing is uploaded to a library or published anywhere;
 * the caller fills the current quote's own fields with the result. */
export async function extractVendorRateFromDocument(
  file: File,
  deskType: "transport" | "warehouse",
  vendorHint?: string,
): Promise<ExtractedTransportRate | ExtractedWarehouseRate> {
  if (file.type !== "application/pdf") {
    throw new ExtractionError("Please choose a PDF file.", "other");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractionError("This file is too large — try a PDF under 6MB.", "other");
  }

  const pdfBase64 = await readFileAsBase64(file);
  const call = httpsCallable<
    { pdfBase64: string; deskType: string; vendorHint?: string },
    ExtractedTransportRate | ExtractedWarehouseRate
  >(getFunctions(getFirebaseApp(), "us-central1"), "extractVendorRateFromDocument");
  try {
    const res = await call({ pdfBase64, deskType, vendorHint });
    return res.data;
  } catch (e) {
    const code = String((e as { code?: string }).code || "");
    if (code.includes("unauthenticated")) throw new ExtractionError("Sign in to use AI extraction.", "signin");
    if (code.includes("failed-precondition")) throw new ExtractionError("AI rate extraction isn't configured yet — ask an admin.", "not-configured");
    if (code.includes("unavailable") || code.includes("internal")) throw new ExtractionError("AI extraction is temporarily unavailable — try again shortly.", "unavailable");
    throw new ExtractionError(e instanceof Error ? e.message : "Something went wrong reading that file.", "other");
  }
}
