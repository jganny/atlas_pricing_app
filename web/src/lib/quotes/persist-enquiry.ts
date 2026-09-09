import type { QueryClient } from "@tanstack/react-query";
import type { EnquiryRecord, SavedQuote } from "@/lib/types";
import { mapQuoteFromSaved } from "@/lib/firebase/quotes";
import { queryKeys } from "@/hooks/query-keys";
import { enquiryHref } from "@/lib/quotes/find-quotes";
import {
  mergeLocalEnquiries,
  rememberLastSavedEnquiry,
  rememberLocalEnquiry,
  rememberLocalQuote,
} from "@/lib/quotes/local-enquiries";

export function persistQuoteToEnquiryDb(
  quote: SavedQuote,
  queryClient?: QueryClient,
): EnquiryRecord {
  rememberLocalQuote(quote);
  const row = mapQuoteFromSaved(quote.id, quote);
  rememberLocalEnquiry(row);
  rememberLastSavedEnquiry(row);
  queryClient?.setQueryData(queryKeys.enquiries, (old: EnquiryRecord[] | undefined) =>
    mergeLocalEnquiries(Array.isArray(old) ? old : []),
  );
  void queryClient?.invalidateQueries({ queryKey: queryKeys.enquiries });
  return row;
}

export function savedEnquiryHref(row: Pick<EnquiryRecord, "id" | "ref">): string {
  return enquiryHref(row);
}

export function savedEnquiryMessage(
  row: EnquiryRecord,
  opts?: { cloud?: "live" | "local" | "cloud-failed"; lanesNote?: string },
): string {
  const extra = opts?.lanesNote ? ` · ${opts.lanesNote}` : "";
  if (opts?.cloud === "live") {
    return `Saved ${row.ref}${extra}. Open Enquiry DB to view all lanes.`;
  }
  if (opts?.cloud === "cloud-failed") {
    return `Saved ${row.ref} on this device (cloud save failed)${extra}. Open Enquiry DB.`;
  }
  return `Saved ${row.ref} to Enquiry DB on this device${extra}.`;
}
