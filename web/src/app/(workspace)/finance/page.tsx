"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useCreditControls, useEnquiries } from "@/hooks/use-atlas-data";
import { formatCurrency } from "@/lib/utils";

export default function FinancePage() {
  const { data: enquiries = [] } = useEnquiries();
  const { data: credits = [] } = useCreditControls();

  const totals = useMemo(() => {
    const won = enquiries.filter((e) => e.status === "won");
    const sell = won.reduce((s, e) => s + (e.amountINR || e.grandTotal || 0), 0);
    const gp = won.reduce((s, e) => s + (e.grossProfit || 0), 0);
    return { sell, gp, blocked: credits.filter((c) => c.blocked).length };
  }, [enquiries, credits]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-[var(--color-atlas-sky)]" />
        <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Finance</h1>
        <Badge tone="info">Phase 13</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
            Won sell (INR)
          </div>
          <div className="text-xl font-extrabold">{formatCurrency(totals.sell, "INR")}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Won GP</div>
          <div className="text-xl font-extrabold">{formatCurrency(totals.gp, "INR")}</div>
        </Card>
        <Card className="py-3">
          <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
            Blocked customers
          </div>
          <div className="text-xl font-extrabold">{totals.blocked}</div>
        </Card>
      </div>
      <Card>
        <p className="text-sm text-[var(--color-text-muted)]">
          Export filtered quotes from{" "}
          <Link href="/enquiries" className="font-semibold text-sky-700">
            Enquiry DB
          </Link>
          . Manage credit blocks in{" "}
          <Link href="/admin" className="font-semibold text-sky-700">
            Admin
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
