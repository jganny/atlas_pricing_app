"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { IS_CHAT_APP, PRICING_APP_URL } from "@/lib/chat-app-mode";
import { queryKeys } from "@/hooks/query-keys";
import { cn } from "@/lib/utils";
import type { EnquiryRecord } from "@/lib/types";

const TONE: Record<string, string> = {
  quoted: "bg-sky-100 text-sky-900",
  open: "bg-sky-100 text-sky-900",
  won: "bg-emerald-100 text-emerald-900",
  lost: "bg-red-100 text-red-900",
  cancelled: "bg-slate-200 text-slate-700",
};

/**
 * A quote reference written in a message shows its live status. It reads only what the Pricing app already has loaded
 * (it never starts a download of its own) and never shows prices. In the Vertex Chat app there is no pricing data,
 * so the chip simply opens the quote in the Pricing app.
 */
export function CaseChip({ reference, mine }: { reference: string; mine: boolean }) {
  const { data } = useQuery<EnquiryRecord[]>({ queryKey: queryKeys.enquiries, queryFn: async () => [], enabled: false, initialData: undefined });
  const row = IS_CHAT_APP ? undefined : data?.find((e) => (e.ref || "").toUpperCase() === reference);
  const cls = cn("mt-1.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs", mine ? "border-white/30 bg-white/10 hover:bg-white/20" : "border-slate-300 bg-white hover:bg-slate-50");
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{reference}</span>
        <span className="block truncate opacity-80">{row ? `${row.customer} · ${row.origin} → ${row.destination}` : IS_CHAT_APP ? "Open in the Pricing app" : "Open the quote"}</span>
      </span>
      {row ? <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", TONE[row.status] ?? TONE.quoted)}>{row.status}</span> : null}
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
    </>
  );
  if (IS_CHAT_APP) {
    return (
      <a href={`${PRICING_APP_URL}enquiries/?q=${encodeURIComponent(reference)}`} className={cls} data-testid="case-chip">
        {body}
      </a>
    );
  }
  return (
    <Link href={row ? `/enquiries?select=${encodeURIComponent(row.id)}` : `/enquiries?q=${encodeURIComponent(reference)}`} className={cls} data-testid="case-chip">
      {body}
    </Link>
  );
}
