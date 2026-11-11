"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useLiveData } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { fetchEmailContacts } from "@/lib/firebase/email-directory";
import { RATE_SOURCE_LABELS, contactsForCarrier, suggestRateSource } from "@/lib/directory/email-directory";

/**
 * Under a carrier's name on a desk: how to get a rate from it, from the directory of email addresses. For example
 * "Ask by email: cargo@etihad.com" or "Online portal". Shown only when the directory knows the carrier; nothing is shown otherwise.
 */
export function CarrierRateHint({ name }: { name: string }) {
  const user = useAuthStore((s) => s.user);
  const q = name.trim();
  const { data } = useQuery({
    queryKey: ["email-directory"],
    queryFn: fetchEmailContacts,
    enabled: useLiveData && !!user && q.length >= 2,
    staleTime: 10 * 60_000,
  });
  if (!data || q.length < 2) return null;
  const code = /^[A-Za-z0-9]{2,4}$/.test(q) ? q : /^([A-Za-z0-9]{2,3})\b/.exec(q)?.[1] ?? "";
  const found = contactsForCarrier(data, { code, name: q });
  if (!found.length) return null;
  const s = suggestRateSource(found);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]" data-testid="carrier-rate-hint">
      <span className="font-semibold text-slate-700">How to get a rate:</span>
      <span>{s.source ? RATE_SOURCE_LABELS[s.source] : "Ask by email"}</span>
      {s.emails.map((e) => (
        <span key={e} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
          <Mail className="h-3 w-3" />
          {e}
        </span>
      ))}
    </p>
  );
}
