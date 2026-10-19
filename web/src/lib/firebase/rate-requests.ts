"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/client";

export interface RateRequestInput {
  ref: string;
  subject: string;
  body: string;
  recipients: Array<{ id: string; name: string; email: string }>;
  senderName: string;
  mode: string;
  direction: string;
  incoterm: string;
  origin: string;
  destination: string;
}

export interface RateRequestResult {
  ref: string;
  sent: number;
  results: Array<{ id: string; name: string; status: "sent" | "failed" | "skipped"; note?: string }>;
}

export class RateRequestError extends Error {}

const friendly: Record<string, string> = {
  unauthenticated: "Sign in again to send rate requests.",
  "resource-exhausted": "You've reached today's sending limit.",
  unavailable: "The mail server couldn't be reached. Try again shortly.",
};

export async function sendRateRequests(input: RateRequestInput): Promise<RateRequestResult> {
  const call = httpsCallable<RateRequestInput, RateRequestResult>(getFunctions(getFirebaseApp(), "us-central1"), "sendRateRequests");
  try {
    return (await call(input)).data;
  } catch (e) {
    const code = String((e as { code?: string }).code || "").replace("functions/", "");
    throw new RateRequestError(friendly[code] && code !== "unavailable" ? friendly[code] : (e as { message?: string }).message || friendly.unavailable);
  }
}

/** Admin: sends one test message to an address, to prove the mailbox can send. */
export async function sendTestEmail(to: string): Promise<void> {
  const call = httpsCallable<{ test: true; testTo: string }, { ok: boolean }>(getFunctions(getFirebaseApp(), "us-central1"), "sendRateRequests");
  try {
    await call({ test: true, testTo: to });
  } catch (e) {
    throw new RateRequestError((e as { message?: string }).message || "The test couldn't be sent.");
  }
}
