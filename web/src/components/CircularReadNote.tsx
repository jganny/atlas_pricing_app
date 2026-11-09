"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { statusLine } from "@/lib/carriers/read-notice";
import { fetchDigest, type CarrierReadSummary } from "@/lib/firebase/carrier-board";
import { cn } from "@/lib/utils";

const TONE = { success: "text-emerald-700", error: "font-semibold text-red-700", info: "text-sky-700", muted: "text-[var(--color-text-muted)]" } as const;
const KIND: Record<string, string> = { liner: "Shipping line", coloader: "Coloader", transporter: "Transporter", warehouse: "Warehouse", courier: "Courier", airline: "Airline", other: "Circular" };

/** Under a circular's row: whether it has been read, and for non-airline circulars what it says. */
export function CircularReadNote({ read }: { read: CarrierReadSummary | undefined }) {
  const [open, setOpen] = useState(false);
  const line = statusLine(read);
  const digest = useQuery({ queryKey: ["circular-digest", read?.circularId], queryFn: () => fetchDigest(read!.circularId), enabled: open && !!read && read.kind === "digest" && read.status === "read", staleTime: 5 * 60_000 });
  if (!read || !line) return null;
  const d = digest.data;
  return (
    <div className="mt-1 text-xs" data-testid="circular-read-note">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1", TONE[line.tone])}>
          {read.status === "reading" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {line.text}
        </span>
        {read.kind === "digest" && read.status === "read" ? (
          <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="inline-flex items-center gap-1 font-semibold text-sky-700">
            What it says <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-border)] bg-white p-3 text-[13px]">
          {digest.isLoading ? <p className="text-[var(--color-text-muted)]">Loading…</p> : null}
          {!digest.isLoading && !d ? <p className="text-[var(--color-text-muted)]">No summary is stored for this one.</p> : null}
          {d ? (
            <>
              <p className="text-[var(--color-text-muted)]">
                {[KIND[d.kind] ?? "Circular", d.company, d.effectiveFrom || d.validTo ? `${d.effectiveFrom || "…"} to ${d.validTo || "…"}` : "", d.appliesTo].filter(Boolean).join(" · ")}
              </p>
              {d.summary.length ? <ul className="list-disc space-y-1 pl-5">{d.summary.map((s, i) => <li key={i}>{s}</li>)}</ul> : null}
              {d.deadlines.length ? (
                <div>
                  <div className="font-semibold text-amber-800">Dates to act by</div>
                  <ul className="list-disc space-y-0.5 pl-5 text-amber-900">{d.deadlines.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              ) : null}
              {d.charges.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-xs">
                    <thead><tr className="border-b border-[var(--color-border-strong)] text-left text-[var(--color-text-muted)]"><th className="py-1 pr-3">Charge</th><th className="py-1 pr-3 text-right">Amount</th><th className="py-1 pr-3">Per</th><th className="py-1">Applies to</th></tr></thead>
                    <tbody>
                      {d.charges.map((c, i) => (
                        <tr key={i} className="border-b border-[var(--color-border)] last:border-b-0">
                          <td className="py-1 pr-3 font-semibold">{c.name}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{c.amount === null ? "—" : `${c.currency ? `${c.currency} ` : ""}${c.amount.toLocaleString("en-IN")}`}</td>
                          <td className="py-1 pr-3 text-[var(--color-text-muted)]">{c.unit}</td>
                          <td className="py-1 text-[var(--color-text-muted)]">{c.appliesTo}{c.note ? ` · ${c.note}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <p className="text-[11px] text-[var(--color-text-muted)]">Written by the reader from the file. Check the original before relying on a number.</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
