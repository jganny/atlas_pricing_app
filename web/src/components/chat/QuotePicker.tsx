"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { belongsToViewersDesk } from "@/lib/auth/desk-seats";
import type { QuoteCard } from "@/lib/chat/types";
import { useAuthStore } from "@/store/auth";
import { isAdminUser } from "@/lib/quotes/team-roles";

/** Pick one of your own desk's quotes to share as a card. Only reference, customer, route and status are shared — never prices. */
export function QuotePicker({ onPick, onClose }: { onPick: (q: QuoteCard) => void; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data = [] } = useEnquiries();
  const [q, setQ] = useState("");
  const admin = isAdminUser(user?.username, user?.role);
  const rows = useMemo(() => {
    const mine = data.filter((e) => admin || belongsToViewersDesk(e, user?.username));
    const needle = q.trim().toLowerCase();
    return mine
      .filter((e) => !needle || `${e.ref} ${e.customer} ${e.origin} ${e.destination}`.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);
  }, [data, q, admin, user?.username]);

  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" role="dialog" aria-label="Share a quote">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by reference, customer or lane" className="min-w-0 flex-1 text-sm outline-none" />
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-60 overflow-y-auto">
        {rows.length === 0 ? <li className="px-4 py-6 text-center text-xs text-slate-500">No matching quotes. Only your desk&apos;s quotes can be shared.</li> : null}
        {rows.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="flex w-full flex-col px-4 py-2 text-left hover:bg-slate-50"
              onClick={() => onPick({ id: e.id, ref: e.ref, customer: e.customer, mode: e.mode, route: `${e.origin} → ${e.destination}`, status: e.status })}
            >
              <span className="text-sm font-bold text-[var(--color-atlas-navy)]">
                {e.ref} · {e.customer}
              </span>
              <span className="text-xs text-slate-500">
                {e.mode} · {e.origin} → {e.destination} · {e.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
