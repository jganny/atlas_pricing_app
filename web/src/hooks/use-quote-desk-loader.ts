"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SavedQuote } from "@/lib/types";
import { getLocalQuote } from "@/lib/quotes/local-enquiries";
import { fetchQuoteById } from "@/lib/firebase/quote-lifecycle";
import { fetchDraft } from "@/lib/firebase/drafts";
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
  const prefillOrigin = searchParams?.get("origin") ?? "";
  const prefillDest = searchParams?.get("dest") ?? "";
  const prefillCustomer = searchParams?.get("customer") ?? "";
  const draftParam = searchParams?.get("draft") ?? null;
  const loadId = editId || duplicateId;
  const isDuplicate = Boolean(duplicateId && !editId);

  const [sourceQuote, setSourceQuote] = useState<SavedQuote | null>(null);
  const [smartPrefill, setSmartPrefill] = useState<SmartQuotePrefill | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingQuoteNumber, setEditingQuoteNumber] = useState<string | number | undefined>();
  const [editingStatus, setEditingStatus] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(!loadId && !smart && !draftParam);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStep, setDraftStep] = useState<string | null>(null);

  useEffect(() => {
    if (draftParam) {
      setReady(false);
      void fetchDraft(draftParam)
        .then((d) => {
          if (!d) {
            setLoadError("That draft is no longer there.");
            return;
          }
          setSourceQuote(d.quote);
          setDraftId(d.id);
          setDraftStep(d.step);
          setLoadError(null);
        })
        .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't open the draft."))
        .finally(() => setReady(true));
      return;
    }
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
    const local = getLocalQuote(loadId);
    if (!useLiveData) {
      if (local) {
        setSourceQuote(local);
        if (editId) {
          setEditingQuoteId(local.id);
          setEditingQuoteNumber(local.quoteNumber);
          setEditingStatus(local.status);
        }
        setLoadError(null);
        setReady(true);
        return;
      }
      setLoadError("Mock mode — load quote from Enquiry DB or switch to live Firebase.");
      setReady(true);
      return;
    }
    setReady(false);
    void fetchQuoteById(loadId)
      .then((q) => {
        const found = q || local;
        if (!found) {
          setLoadError("Quote not found.");
          return;
        }
        setSourceQuote(found);
        if (editId) {
          setEditingQuoteId(found.id);
          setEditingQuoteNumber(found.quoteNumber);
          setEditingStatus(found.status);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setReady(true));
  }, [loadId, editId, isDuplicate, smart, deskMode, draftParam]);

  return {
    ready,
    loadError,
    sourceQuote,
    smartPrefill,
    isDuplicate,
    draftId,
    draftStep,
    setDraftId,
    isEditing: Boolean(editingQuoteId),
    editingQuoteId,
    editingQuoteNumber,
    editingStatus,
    prefillOrigin,
    prefillDest,
    prefillCustomer,
    clearLoadedQuote() {
      setSourceQuote(null);
      setSmartPrefill(null);
      setEditingQuoteId(null);
      setEditingQuoteNumber(undefined);
      setEditingStatus(undefined);
      setDraftId(null);
      setDraftStep(null);
      setLoadError(null);
      setReady(true);
      clearSmartQuotePrefill();
    },
    banner: editId
      ? `Amending quote ${editId}`
      : draftId
        ? "Continuing your saved draft — Save quote when it is ready"
      : duplicateId
        ? `Duplicating quote ${duplicateId} — saves as new`
        : smartPrefill
          ? "Prefill from Smart Quote — review carriers and save"
          : null,
  };
}
