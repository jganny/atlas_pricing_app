"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SavedQuote } from "@/lib/types";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";
import { useLiveData } from "@/lib/api";

export function useQuoteDeskLoader() {
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit") ?? null;
  const duplicateId = searchParams?.get("duplicate") ?? null;
  const loadId = editId || duplicateId;
  const isDuplicate = Boolean(duplicateId && !editId);

  const [sourceQuote, setSourceQuote] = useState<SavedQuote | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingQuoteNumber, setEditingQuoteNumber] = useState<string | number | undefined>();
  const [editingStatus, setEditingStatus] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(!loadId);

  useEffect(() => {
    if (!loadId) {
      setReady(true);
      return;
    }
    if (!useLiveData) {
      setLoadError("Mock mode — load quote from legacy or switch to live Firebase.");
      setReady(true);
      return;
    }
    setReady(false);
    void fetchQuoteById(loadId)
      .then((q) => {
        if (!q) {
          setLoadError("Quote not found.");
          return;
        }
        setSourceQuote(q);
        if (editId) {
          setEditingQuoteId(q.id);
          setEditingQuoteNumber(q.quoteNumber);
          setEditingStatus(q.status);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setReady(true));
  }, [loadId, editId, isDuplicate]);

  return {
    ready,
    loadError,
    sourceQuote,
    isDuplicate,
    isEditing: Boolean(editingQuoteId),
    editingQuoteId,
    editingQuoteNumber,
    editingStatus,
    banner: editId
      ? `Amending quote ${editId}`
      : duplicateId
        ? `Duplicating quote ${duplicateId} — saves as new`
        : null,
  };
}
