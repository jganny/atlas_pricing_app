"use client";

import { useCallback, useMemo } from "react";
import { useEnquiries, useWonFollowUps } from "@/hooks/use-atlas-data";
import { useSeatsVersion } from "@/hooks/use-seats-version";
import { isAdminUser } from "@/lib/quotes/team-roles";
import type { EnquiryRecord } from "@/lib/types";
import { wonRowsForViewer } from "@/lib/quotes/won-scope";
import { useAuthStore } from "@/store/auth";

/**
 * Won follow-ups for the signed-in user: their own desk's rows, or everyone's for the admin.
 * `quoteOf` finds the quote behind a row, which is how rows saved before owners were stamped get matched.
 */
export function useScopedWonFollowUps() {
  const user = useAuthStore((s) => s.user);
  const admin = isAdminUser(user?.username, user?.role);
  const all = useWonFollowUps();
  const { data: enquiries = [] } = useEnquiries();
  useSeatsVersion();
  const byId = useMemo(() => new Map<string, EnquiryRecord>(enquiries.map((e) => [e.id, e])), [enquiries]);
  const quoteOf = useCallback((id: string) => byId.get(id), [byId]);
  const rows = useMemo(
    () => wonRowsForViewer(all.data ?? [], user?.username, admin, quoteOf),
    [all.data, user?.username, admin, quoteOf],
  );
  return { rows, allRows: all.data ?? [], isLoading: all.isLoading, admin, quoteOf };
}
