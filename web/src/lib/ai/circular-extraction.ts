"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/client";
import type { WeightBreakName } from "@atlas/pricing-core";
import type { CourierExtractionResult } from "@/lib/quotes/courier-tariff";

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly kind: "signin" | "not-configured" | "unavailable" | "other",
  ) {
    super(message);
  }
}

export interface ExtractedBreak {
  sell: number | null;
  buy: number | null;
  confidence: "high" | "needs_check";
  note: string;
}

export interface ExtractedAirTariff {
  carrier: string;
  carrierCode: string;
  origin: string;
  destination: string;
  currency: string;
  sourcePage: number | null;
  breaks: Record<WeightBreakName, ExtractedBreak>;
}

export interface ExtractedContainer extends ExtractedBreak {
  type: string;
}

export interface ExtractedSeaTariff {
  carrier: string;
  carrierCode: string;
  origin: string;
  destination: string;
  currency: string;
  sourcePage: number | null;
  containers: ExtractedContainer[];
  lclRate: ExtractedBreak | null;
}

function rethrowAsExtractionError(e: unknown): never {
  const code = String((e as { code?: string }).code || "");
  if (code.includes("unauthenticated")) throw new ExtractionError("Sign in to use AI extraction.", "signin");
  if (code.includes("failed-precondition")) throw new ExtractionError("AI rate extraction isn't configured yet — ask an admin.", "not-configured");
  if (code.includes("unavailable") || code.includes("internal")) throw new ExtractionError("AI extraction is temporarily unavailable — try again shortly.", "unavailable");
  throw new ExtractionError(e instanceof Error ? e.message : "Something went wrong reading that circular.", "other");
}

/** Calls the deployed `extractAirTariffFromCircular` Cloud Function — reads the
 * circular's PDF server-side and returns a draft only; nothing is published
 * until the desk reviews it and calls publishAirTariffBreaks. */
export async function extractAirTariffFromCircular(
  storagePath: string,
  carrierHint?: string,
): Promise<ExtractedAirTariff> {
  const call = httpsCallable<{ storagePath: string; carrierHint?: string }, ExtractedAirTariff>(
    getFunctions(getFirebaseApp(), "us-central1"),
    "extractAirTariffFromCircular",
  );
  try {
    const res = await call({ storagePath, carrierHint });
    return res.data;
  } catch (e) {
    rethrowAsExtractionError(e);
  }
}

/** Same idea, for sea freight — reads the circular's PDF server-side and returns
 * a draft only; nothing is published until the desk reviews it and calls
 * publishSeaTariffRow. */
export async function extractSeaTariffFromCircular(
  storagePath: string,
  carrierHint?: string,
): Promise<ExtractedSeaTariff> {
  const call = httpsCallable<{ storagePath: string; carrierHint?: string }, ExtractedSeaTariff>(
    getFunctions(getFirebaseApp(), "us-central1"),
    "extractSeaTariffFromCircular",
  );
  try {
    const res = await call({ storagePath, carrierHint });
    return res.data;
  } catch (e) {
    rethrowAsExtractionError(e);
  }
}

/** Same idea, for courier rate cards — reads the circular's PDF server-side and
 * returns a weight×zone grid draft only; nothing is published until the desk
 * reviews it and calls publishCourierTariffBook via
 * buildCourierTariffBookFromExtraction. */
export async function extractCourierTariffFromCircular(
  storagePath: string,
  carrierHint?: string,
): Promise<CourierExtractionResult> {
  const call = httpsCallable<{ storagePath: string; carrierHint?: string }, CourierExtractionResult>(
    getFunctions(getFirebaseApp(), "us-central1"),
    "extractCourierTariffFromCircular",
  );
  try {
    const res = await call({ storagePath, carrierHint });
    return res.data;
  } catch (e) {
    rethrowAsExtractionError(e);
  }
}
