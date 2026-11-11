"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import type { RateRead } from "@/lib/rates/rate-email";

export interface RateEmailRequest {
  mode: "air" | "sea";
  origin?: string;
  destination?: string;
  weightKg?: number;
  emails: Array<{ fromName: string; fromEmail: string; subject: string; text: string }>;
}

/** Reads vendor or agent emails into rates (AI, about ₹0.30 or less per email). Only when a person presses the button. */
export async function readRateEmails(req: RateEmailRequest): Promise<RateRead[]> {
  const call = httpsCallable<RateEmailRequest, { reads: RateRead[] }>(getFunctions(getFirebaseApp(), "us-central1"), "readRateEmail", { timeout: 180_000 });
  const res = await call(req);
  return res.data.reads;
}
