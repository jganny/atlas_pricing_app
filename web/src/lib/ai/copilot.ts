"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase/client";
import type { GuideEntry } from "@/lib/ai/feature-guide";
import { buildCopilotMessage } from "@/lib/ai/copilot-prompt";

export class CopilotError extends Error {
  constructor(
    message: string,
    readonly kind: "signin" | "not-configured" | "unavailable" | "other",
  ) {
    super(message);
  }
}

/** Calls the deployed `atlasCopilot` Cloud Function (Anthropic key stays server-side). */
export async function askCopilot(opts: {
  question: string;
  entries: GuideEntry[];
  pathname: string;
  role?: string;
}): Promise<string> {
  const call = httpsCallable<{ message: string; workspace: string; role: string }, { reply: string }>(
    getFunctions(getFirebaseApp(), "us-central1"),
    "atlasCopilot",
  );
  try {
    const res = await call({
      message: buildCopilotMessage(opts.question, opts.entries, opts.pathname),
      workspace: `Test app ${opts.pathname}`,
      role: opts.role || "user",
    });
    return res.data.reply;
  } catch (e) {
    const code = String((e as { code?: string }).code || "");
    if (code.includes("unauthenticated")) throw new CopilotError("Sign in to use the AI assistant.", "signin");
    if (code.includes("failed-precondition")) throw new CopilotError("The AI assistant isn't configured yet — ask an admin.", "not-configured");
    if (code.includes("unavailable") || code.includes("internal")) throw new CopilotError("The AI assistant is temporarily unavailable — try again shortly.", "unavailable");
    throw new CopilotError(e instanceof Error ? e.message : "Something went wrong asking the AI.", "other");
  }
}
