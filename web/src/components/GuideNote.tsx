"use client";

import { Sparkles } from "lucide-react";

/** Short next-step copy so the workspace itself guides a first-time user. */
export function GuideNote({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <p
      data-testid={testId}
      className="mb-4 flex gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-[13px] leading-snug text-sky-950 print:hidden"
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
