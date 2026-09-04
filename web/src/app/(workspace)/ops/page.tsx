"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { formatCurrency } from "@/lib/utils";

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
          Operations board
        </h1>
        <Badge tone="info">Phase 13</Badge>
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        Won shipments ready for ops handoff — open Enquiry DB for full lifecycle.
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
                      href={`/enquiries/?q=${encodeURIComponent(e.ref)}`}
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
                  <td className="px-3 py-2">
                    {formatCurrency(e.amountINR || e.grandTotal || 0, e.currency || "INR")}
                  </td>
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
