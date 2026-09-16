"use client";

import { useEffect, useRef, useState } from "react";
import { useEnquiries } from "@/hooks/use-atlas-data";
import {
  extractAirCharges,
  extractSeaCharges,
  fetchCandidateQuotes,
  selectCandidateIds,
  type AirAutofillResult,
  type HistoricalMatchFilter,
  type SeaAutofillResult,
} from "@/lib/quotes/historical-autofill";

export interface UseHistoricalAutofillInput {
  deskType: "air" | "sea";
  origin: string;
  destination: string;
  incoterm: string;
  currency: string;
  module: "export" | "import";
  customer?: string;
  /** One raw (not normalized) carrier name per carrier card currently on screen. */
  carrierNames: string[];
}

const DEBOUNCE_MS = 500;

/**
 * Silently, in the background, finds charge lines that have been
 * consistent across the user's own quote history for this exact
 * route/incoterm/currency/module and returns them keyed by normalized
 * carrier name — the desk page applies them to untouched fields only.
 * See historical-autofill.ts for the matching/consistency rules.
 */
export function useHistoricalAutofill(input: UseHistoricalAutofillInput) {
  const { data: enquiries = [] } = useEnquiries();
  const [air, setAir] = useState<Record<string, AirAutofillResult>>({});
  const [sea, setSea] = useState<Record<string, SeaAutofillResult>>({});
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const carrierKey = input.carrierNames.join("|");

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!input.origin.trim() || !input.destination.trim() || !input.incoterm.trim()) {
      setAir({});
      setSea({});
      return;
    }
    timer.current = setTimeout(() => {
      const myRequest = ++requestId.current;
      setLoading(true);
      void (async () => {
        const carriers = Array.from(
          new Set(input.carrierNames.map((n) => n.trim()).filter(Boolean)),
        );
        const baseFilter: HistoricalMatchFilter = {
          deskType: input.deskType,
          origin: input.origin,
          destination: input.destination,
          incoterm: input.incoterm,
          currency: input.currency,
          module: input.module,
          customer: input.customer,
        };
        const ids = selectCandidateIds(enquiries, baseFilter);
        const quotes = ids.length ? await fetchCandidateQuotes(ids) : [];
        if (requestId.current !== myRequest) return; // superseded by a newer change

        if (input.deskType === "air") {
          const next: Record<string, AirAutofillResult> = {};
          for (const carrierName of carriers.length ? carriers : [""]) {
            next[carrierName.toLowerCase()] = extractAirCharges(quotes, { ...baseFilter, carrierName });
          }
          setAir(next);
          setSea({});
        } else {
          const next: Record<string, SeaAutofillResult> = {};
          for (const carrierName of carriers.length ? carriers : [""]) {
            next[carrierName.toLowerCase()] = extractSeaCharges(quotes, { ...baseFilter, carrierName });
          }
          setSea(next);
          setAir({});
        }
        setLoading(false);
      })();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // enquiries is a React Query cache array — safe to depend on its identity here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    input.deskType,
    input.origin,
    input.destination,
    input.incoterm,
    input.currency,
    input.module,
    input.customer,
    carrierKey,
    enquiries,
  ]);

  return { air, sea, loading };
}
