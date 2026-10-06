"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/client";
import type { InboxEnquiry } from "@/lib/types";
import { senderFirstName, understandEnquiry } from "@/lib/mail/reply-draft";

export class DraftError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface ReplyDraft {
  subject: string;
  body: string;
}

/** Asks the deployed `draftEnquiryReply` Cloud Function to word a price-free reply. */
export async function draftEnquiryReply(
  item: InboxEnquiry,
  mode: "air" | "sea",
  signOff: string,
): Promise<ReplyDraft> {
  const { understood, missing } = understandEnquiry(item, mode);
  const call = httpsCallable<Record<string, unknown>, ReplyDraft>(
    getFunctions(getFirebaseApp(), "us-central1"),
    "draftEnquiryReply",
  );
  try {
    const res = await call({
      subject: item.subject,
      bodyPreview: item.bodyPreview || item.body || "",
      fromName: senderFirstName(item.from),
      signOff,
      understood,
      missing,
    });
    return res.data;
  } catch (e) {
    const code = String((e as { code?: string }).code || "");
    if (code.includes("unauthenticated")) throw new DraftError("Sign in to use AI drafting.");
    if (code.includes("failed-precondition")) throw new DraftError("AI drafting isn't configured yet — ask an admin.");
    if (code.includes("unavailable") || code.includes("internal")) {
      throw new DraftError("AI drafting is temporarily unavailable — try again shortly.");
    }
    throw new DraftError(e instanceof Error ? e.message : "Couldn't draft a reply.");
  }
}
