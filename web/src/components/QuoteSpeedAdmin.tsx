"use client";

import { useMemo } from "react";
import { Timer } from "lucide-react";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { DESK_SEATS } from "@/lib/auth/desk-seats";
import { formatSeconds, speedBy } from "@/lib/quotes/quote-timer";

/** Admin: how long new quotes take from opening a desk to saving (measured automatically, last 30 days). */
export function QuoteSpeedAdmin() {
  const { data = [] } = useEnquiries();
  const rows = useMemo(
    () => speedBy(data, (q) => (q.deskSeat ? DESK_SEATS.find((s) => s.id === q.deskSeat)?.label ?? q.deskSeat : "Individual logins"), 30),
    [data],
  );
  const byMode = useMemo(() => speedBy(data, (q) => q.mode || "other", 30), [data]);
  const total = rows.reduce((n, r) => n + r.count, 0);
  const under30 = rows.reduce((n, r) => n + r.under30, 0);

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="quote-speed">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--color-atlas-navy)]">
        <Timer className="h-4 w-4" /> Time to quote
      </h2>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        From opening a desk to saving a new quote, measured automatically since this was switched on. Last 30 days; quotes saved before then have no time.
      </p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">No timed quotes yet. They appear as new quotes are saved.</p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <b>{under30}</b> of <b>{total}</b> quotes were saved within 30 seconds ({Math.round((under30 / total) * 100)}%).
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {[{ title: "By desk", list: rows }, { title: "By mode", list: byMode }].map((g) => (
              <table key={g.title} className="w-full text-left text-sm">
                <thead className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="py-1">{g.title}</th>
                    <th className="py-1 text-right">Quotes</th>
                    <th className="py-1 text-right">Typical time</th>
                    <th className="py-1 text-right">Within 30 s</th>
                  </tr>
                </thead>
                <tbody>
                  {g.list.map((r) => (
                    <tr key={r.key} className="border-t border-[var(--color-border)]">
                      <td className="py-1.5 font-semibold capitalize">{r.key}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.count}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatSeconds(r.medianSeconds)}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.under30}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
