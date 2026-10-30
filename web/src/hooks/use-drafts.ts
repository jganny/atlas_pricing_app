"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeDrafts } from "@/lib/firebase/drafts";
import { draftsForViewer, type DraftMode, type DraftRow } from "@/lib/quotes/drafts";
import { useAuthStore } from "@/store/auth";

/** The signed-in user's drafts (their desk's), newest first. Optionally only one desk's. */
export function useMyDrafts(mode?: DraftMode): DraftRow[] {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<DraftRow[]>([]);
  useEffect(() => {
    if (!user) return;
    return subscribeDrafts(setRows);
  }, [user]);
  return useMemo(() => draftsForViewer(rows, user?.username, mode), [rows, user?.username, mode]);
}
