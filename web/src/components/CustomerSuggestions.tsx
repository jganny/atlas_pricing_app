"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/query-keys";
import { customNames, getCustomEntriesVersion, subscribeCustomEntries } from "@/lib/custom-entries";
import type { EnquiryRecord } from "@/lib/types";

export const CUSTOMER_SUGGESTIONS_ID = "atlas-customer-suggestions";

/**
 * One shared list of customer names for every desk's Customer box: the custom
 * entries saved by either app, plus every customer on a saved quote. Rendered
 * once; inputs point at it with list="atlas-customer-suggestions".
 */
export function CustomerSuggestions() {
  const version = useSyncExternalStore(subscribeCustomEntries, getCustomEntriesVersion, () => 0);
  // Reads whatever the enquiries list already loaded — never fetches on its own.
  const { data: rows } = useQuery<EnquiryRecord[]>({
    queryKey: queryKeys.enquiries,
    queryFn: async () => [],
    enabled: false,
    staleTime: Infinity,
  });
  const names = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of [...customNames("customers"), ...(rows ?? []).map((r) => r.customer)]) {
      const t = (n || "").trim();
      if (t.length < 2 || /^(draft|—|-)$/i.test(t)) continue;
      if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b)).slice(0, 1500);
    // `version` re-runs this when the shared custom entries change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, version]);
  return (
    <datalist id={CUSTOMER_SUGGESTIONS_ID}>
      {names.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}
