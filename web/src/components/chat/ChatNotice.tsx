"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { NOTICE_BODY, NOTICE_TITLE } from "@/lib/chat/chat-logic";

/** Shown once, the first time someone opens chat. */
export function ChatNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center p-4">
      <div role="dialog" aria-labelledby="chat-notice-title" className="max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-lg">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-atlas-navy)] text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 id="chat-notice-title" className="text-lg font-extrabold text-[var(--color-atlas-navy)]">
          {NOTICE_TITLE}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{NOTICE_BODY}</p>
        <Button className="mt-5 w-full" onClick={onAccept} data-testid="chat-notice-accept">
          Got it, open chat
        </Button>
      </div>
    </div>
  );
}
