"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SavedQuote } from "@/lib/types";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";
import { useLiveData } from "@/lib/api";
import {
  clearSmartQuotePrefill,
  peekSmartQuotePrefill,
  type SmartQuotePrefill,
} from "@/lib/pricing/smart-quote-prefill";

export function useQuoteDeskLoader(deskMode?: "air" | "sea") {
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit") ?? null;
  const duplicateId = searchParams?.get("duplicate") ?? null;
  const smart = searchParams?.get("smart") ?? null;
  const loadId = editId || duplicateId;
  const isDuplicate = Boolean(duplicateId && !editId);

  const [sourceQuote, setSourceQuote] = useState<SavedQuote | null>(null);
  const [smartPrefill, setSmartPrefill] = useState<SmartQuotePrefill | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingQuoteNumber, setEditingQuoteNumber] = useState<string | number | undefined>();
  const [editingStatus, setEditingStatus] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(!loadId && !smart);

  useEffect(() => {
    if (smart && deskMode) {
      const prefill = peekSmartQuotePrefill(deskMode);
      if (prefill) {
        setSmartPrefill(prefill);
        setLoadError(null);
        setReady(true);
        return;
      }
      setLoadError("Smart Quote prefill expired — run Smart Quote again.");
      setReady(true);
      return;
    }

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
  }, [loadId, editId, isDuplicate, smart, deskMode]);

  return {
    ready,
    loadError,
    sourceQuote,
    smartPrefill,
    isDuplicate,
    isEditing: Boolean(editingQuoteId),
    editingQuoteId,
    editingQuoteNumber,
    editingStatus,
    clearLoadedQuote() {
      setSourceQuote(null);
      setSmartPrefill(null);
      setEditingQuoteId(null);
      setEditingQuoteNumber(undefined);
      setEditingStatus(undefined);
      setLoadError(null);
      setReady(true);
      clearSmartQuotePrefill();
    },
    banner: editId
      ? `Amending quote ${editId}`
      : duplicateId
        ? `Duplicating quote ${duplicateId} — saves as new`
        : smartPrefill
          ? "Prefill from Smart Quote — review carriers and save"
          : null,
  };
}
