"use client";

import { useEffect, useRef, useState } from "react";
import { useEnquiries } from "@/hooks/use-atlas-data";
import type { EnquiryRecord } from "@/lib/types";
import {
  extractAirCharges,
  extractCourierCharges,
  extractSeaCharges,
  extractTransportCharges,
  extractWarehouseCharges,
  fetchCandidateQuotes,
  selectCandidateIds,
  type AirAutofillResult,
  type CourierAutofillResult,
  type HistoricalMatchFilter,
  type SeaAutofillResult,
  type TransportAutofillResult,
  type WarehouseAutofillResult,
} from "@/lib/quotes/historical-autofill";

export interface UseHistoricalAutofillInput {
  deskType: "air" | "sea" | "courier" | "transport" | "warehouse";
  origin: string;
  destination: string;
  /** Air/Sea only. */
  incoterm?: string;
  currency: string;
  /** Air/Sea only. */
  module?: "export" | "import";
  /** Courier only. */
  scope?: "domestic" | "international";
  customer?: string;
  /** One raw (not normalized) carrier name per carrier card currently on screen. Unused for Warehouse. */
  carrierNames: string[];
}

const DEBOUNCE_MS = 500;
// Stable empty list: `data: enquiries = []` made a NEW array every render while the
// enquiries query was still loading, re-running the effect below on every render.
const NO_ENQUIRIES: EnquiryRecord[] = [];
const EMPTY: Record<string, never> = {};

/**
 * Silently, in the background, finds charge lines that have been
 * consistent across the user's own quote history for this exact
 * route/incoterm/currency/module (or the Courier/Transport/Warehouse
 * equivalent) and returns them keyed by normalized carrier name — the
 * desk page applies them to untouched fields only. See
 * historical-autofill.ts for the matching/consistency rules.
 */
export function useHistoricalAutofill(input: UseHistoricalAutofillInput) {
  const { data } = useEnquiries();
  const enquiries = data ?? NO_ENQUIRIES;
  const [air, setAir] = useState<Record<string, AirAutofillResult>>({});
  const [sea, setSea] = useState<Record<string, SeaAutofillResult>>({});
  const [courier, setCourier] = useState<Record<string, CourierAutofillResult>>({});
  const [transport, setTransport] = useState<Record<string, TransportAutofillResult>>({});
  const [warehouse, setWarehouse] = useState<WarehouseAutofillResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const carrierKey = input.carrierNames.join("|");

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const needsIncoterm = input.deskType === "air" || input.deskType === "sea";
    const needsDestination = input.deskType !== "warehouse";
    if (
      !input.origin.trim() ||
      (needsDestination && !input.destination.trim()) ||
      (needsIncoterm && !input.incoterm?.trim())
    ) {
      setAir((cur) => (Object.keys(cur).length ? {} : cur));
      setSea((cur) => (Object.keys(cur).length ? {} : cur));
      setCourier((cur) => (Object.keys(cur).length ? {} : cur));
      setTransport((cur) => (Object.keys(cur).length ? {} : cur));
      setWarehouse((cur) => (cur ? null : cur));
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
          scope: input.scope,
          customer: input.customer,
        };
        const ids = selectCandidateIds(enquiries, baseFilter);
        const quotes = ids.length ? await fetchCandidateQuotes(ids) : [];
        if (requestId.current !== myRequest) return; // superseded by a newer change

        const clearOthers = (keep: "air" | "sea" | "courier" | "transport" | "warehouse") => {
          if (keep !== "air") setAir(EMPTY);
          if (keep !== "sea") setSea(EMPTY);
          if (keep !== "courier") setCourier(EMPTY);
          if (keep !== "transport") setTransport(EMPTY);
          if (keep !== "warehouse") setWarehouse(null);
        };

        if (input.deskType === "air") {
          const next: Record<string, AirAutofillResult> = {};
          for (const carrierName of carriers.length ? carriers : [""]) {
            next[carrierName.toLowerCase()] = extractAirCharges(quotes, { ...baseFilter, carrierName });
          }
          setAir(next);
          clearOthers("air");
        } else if (input.deskType === "sea") {
          const next: Record<string, SeaAutofillResult> = {};
          for (const carrierName of carriers.length ? carriers : [""]) {
            next[carrierName.toLowerCase()] = extractSeaCharges(quotes, { ...baseFilter, carrierName });
          }
          setSea(next);
          clearOthers("sea");
        } else if (input.deskType === "courier") {
          const next: Record<string, CourierAutofillResult> = {};
          for (const carrierName of carriers) {
            next[carrierName.toLowerCase()] = extractCourierCharges(quotes, { ...baseFilter, carrierName });
          }
          setCourier(next);
          clearOthers("courier");
        } else if (input.deskType === "transport") {
          const next: Record<string, TransportAutofillResult> = {};
          for (const carrierName of carriers) {
            next[carrierName.toLowerCase()] = extractTransportCharges(quotes, { ...baseFilter, carrierName });
          }
          setTransport(next);
          clearOthers("transport");
        } else {
          setWarehouse(extractWarehouseCharges(quotes, baseFilter));
          clearOthers("warehouse");
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
    input.scope,
    input.customer,
    carrierKey,
    enquiries,
  ]);

  return { air, sea, courier, transport, warehouse, loading };
}
