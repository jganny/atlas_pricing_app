"use client";

/** Team chat's helper: @Vertex answers, catch-up summaries and translation. Uses the same assistant as Ask Vertex. */
import { demoAnswer } from "@/lib/ai/demo-chat";
import { streamChat } from "@/lib/ai/vertex-chat";
import { useLiveData } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebase/client";

/** Streams an answer and returns the full text. Quotes are never looked up here: others in the room may read it. */
export async function runAssistant(
  prompt: string,
  opts: { signal?: AbortSignal; onText?: (soFar: string) => void; web?: boolean } = {},
): Promise<string> {
  let text = "";
  const push = (chunk: string) => {
    text += chunk;
    opts.onText?.(text);
  };
  if (!useLiveData) {
    await demoAnswer(prompt, push, opts.signal);
    return text;
  }
  let failure = "";
  await streamChat({
    getToken: async () => {
      const u = getFirebaseAuth().currentUser;
      if (!u) throw new Error("not signed in");
      return u.getIdToken();
    },
    text: prompt,
    history: [],
    attachments: [],
    mode: "quick",
    web: opts.web ?? false,
    quotes: false,
    workspace: "/chat",
    signal: opts.signal,
    onEvent: (ev) => {
      if (ev.t === "delta") push(ev.text);
      else if (ev.t === "error") failure = ev.message;
    },
  });
  if (failure && !text) throw new Error(failure);
  return text;
}
