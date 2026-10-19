"use client";

import Link from "next/link";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { openQuoteHref } from "@/lib/quotes/won-followups";
import { EnquiryInspector } from "@/components/EnquiryInspector";
import type { EnquiryRecord } from "@/lib/types";

/**
 * Opens a quote over the current page with every action the Enquiry DB offers — View / Print / share,
 * Amend on desk, Duplicate — so nobody has to leave the list they are working from.
 * `quote` is whatever the list knows (id and ref at least); the full record is looked up by id.
 */
export function QuoteDrawer({
  quote,
  onClose,
}: {
  quote: { id: string; ref: string; customer?: string };
  onClose: () => void;
}) {
  const { data: enquiries = [], isLoading } = useEnquiries();
  const found = enquiries.find((e) => e.id === quote.id) ?? enquiries.find((e) => e.ref === quote.ref);

  const row: EnquiryRecord =
    found ??
    ({
      id: quote.id,
      ref: quote.ref,
      customer: quote.customer ?? "",
      mode: "air",
      origin: "",
      destination: "",
      status: "won",
      slaHoursOpen: 0,
      assignee: "",
      creator: "",
      createdAt: new Date().toISOString(),
    } satisfies EnquiryRecord);

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Quote ${quote.ref}`}>
      <button type="button" className="fixed inset-0 cursor-default" aria-label="Close quote" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl">
        {isLoading && !found ? (
          <div className="rounded-xl bg-white p-6 text-sm text-slate-600">Loading quote…</div>
        ) : (
          <>
            <EnquiryInspector row={row} onClose={onClose} />
            <p className="mt-2 text-center text-xs text-white">
              <Link href={openQuoteHref(row.id, row.ref)} className="font-semibold underline">
                Open in Enquiry DB
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
