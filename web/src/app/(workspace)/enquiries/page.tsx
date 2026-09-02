"use client";

import { Loader2 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useLiveData } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

function slaTone(hours: number) {
  if (hours > 8) return "error" as const;
  if (hours > 4) return "warn" as const;
  return "success" as const;
}

export default function EnquiryDatabasePage() {
  const { data: rows = [], isLoading, error } = useEnquiries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Enquiry database</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {useLiveData
            ? "Live quotes from Firestore — read-only preview."
            : "Mock pipeline view — SLA strip logic mirrored from legacy atlas-sla.js."}
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-800">Could not load enquiries.</p>
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading enquiries…
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-slate-50 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Lane</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-semibold">{row.ref}</td>
                  <td className="px-4 py-3">{row.customer}</td>
                  <td className="px-4 py-3 uppercase">{row.mode}</td>
                  <td className="px-4 py-3">
                    {row.origin} → {row.destination}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        row.status === "open" || row.status === "quoted"
                          ? "warn"
                          : row.status === "won"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === "open" || row.status === "quoted" ? (
                      <Badge tone={slaTone(row.slaHoursOpen)}>{row.slaHoursOpen}h open</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {row.grandTotal ? formatCurrency(row.grandTotal) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
