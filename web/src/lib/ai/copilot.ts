"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseAuth } from "@/lib/firebase/client";
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

const STREAM_URL = "https://us-central1-vertex-35d95.cloudfunctions.net/atlasCopilotStream";

/**
 * Same assistant as askCopilot, streamed — onChunk fires as each piece of the
 * reply arrives, so the caller can show it appearing word by word instead of
 * waiting for the whole answer. Resolves once the stream ends.
 */
export async function askCopilotStream(
  opts: { question: string; entries: GuideEntry[]; pathname: string; role?: string },
  onChunk: (piece: string) => void,
): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new CopilotError("Sign in to use the AI assistant.", "signin");
  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: buildCopilotMessage(opts.question, opts.entries, opts.pathname),
        workspace: `Test app ${opts.pathname}`,
        role: opts.role || "user",
      }),
    });
  } catch {
    throw new CopilotError("The AI assistant is temporarily unavailable — try again shortly.", "unavailable");
  }

  if (!res.ok || !res.body) {
    if (res.status === 401) throw new CopilotError("Sign in to use the AI assistant.", "signin");
    if (res.status === 412) throw new CopilotError("The AI assistant isn't configured yet — ask an admin.", "not-configured");
    throw new CopilotError("The AI assistant is temporarily unavailable — try again shortly.", "unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let gotAny = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const piece = decoder.decode(value, { stream: true });
    if (piece) {
      gotAny = true;
      onChunk(piece);
    }
  }
  if (!gotAny) throw new CopilotError("The AI assistant is temporarily unavailable — try again shortly.", "unavailable");
}
