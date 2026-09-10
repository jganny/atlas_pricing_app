"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { formatQuoteSell } from "@/lib/quotes/money";

export default function OpsPage() {
  const { data: enquiries = [], isLoading } = useEnquiries();
  const won = useMemo(
    () => enquiries.filter((e) => e.status === "won").slice(0, 40),
    [enquiries],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">
          Won jobs
        </h1>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Jobs handed to operations after sales. Open a row for the full quote in{" "}
        <Link href="/enquiries/?pipeline=won" className="font-semibold text-[var(--color-atlas-sky)] underline">
          Enquiry DB
        </Link>
        . Amounts show the quoted currency and the INR equivalent.
      </p>

      {isLoading ? (
        <Card>Loading…</Card>
      ) : won.length === 0 ? (
        <Card className="text-sm text-[var(--color-text-muted)]">No won quotes yet.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Lane</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Desk</th>
              </tr>
            </thead>
            <tbody>
              {won.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/enquiries/?q=${encodeURIComponent(e.ref)}&select=${encodeURIComponent(e.id)}&pipeline=won`}
                      className="font-semibold text-sky-700"
                    >
                      {e.ref}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{e.customer}</td>
                  <td className="px-3 py-2">
                    {e.origin} → {e.destination}
                  </td>
                  <td className="px-3 py-2 capitalize">{e.mode}</td>
                  <td className="px-3 py-2 tabular-nums">{formatQuoteSell(e)}</td>
                  <td className="px-3 py-2">{e.assignee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
