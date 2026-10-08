"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { EmptyNumberInput } from "@/components/EmptyNumberInput";
import { toast } from "@/components/Toast";
import {
  extractSeaTariffFromCircular,
  ExtractionError,
  type ExtractedBreak,
  type ExtractedContainer,
} from "@/lib/ai/circular-extraction";
import { publishSeaTariffRow } from "@/lib/firebase/circulars";
import type { CircularRecord } from "@/lib/types";

const CONTAINER_TYPE_OPTIONS = [
  "20'GP",
  "40'GP",
  "40'HC",
  "45'HC",
  "20'RF",
  "40'RF",
  "20'FR",
  "40'FR",
  "20'OT",
  "40'OT",
];

function blankRow(): ExtractedContainer {
  return { type: CONTAINER_TYPE_OPTIONS[0], sell: null, buy: null, confidence: "high", note: "" };
}

export function SeaTariffExtractionReview({
  circular,
  uploadedBy,
  onClose,
  onPublished,
}: {
  circular: CircularRecord;
  uploadedBy: string;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [carrier, setCarrier] = useState(circular.carrier || "");
  const [carrierCode, setCarrierCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sourcePage, setSourcePage] = useState<number | null>(null);
  const [containers, setContainers] = useState<ExtractedContainer[] | null>(null);
  const [lclRate, setLclRate] = useState<ExtractedBreak | null>(null);
  const [lclIncluded, setLclIncluded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void extractSeaTariffFromCircular(circular.storagePath || "", circular.carrier)
      .then((result) => {
        if (cancelled) return;
        setCarrier(result.carrier || circular.carrier || "");
        setCarrierCode(result.carrierCode);
        setOrigin(result.origin);
        setDestination(result.destination);
        setCurrency(result.currency || "USD");
        setSourcePage(result.sourcePage);
        setContainers(result.containers);
        setLclRate(result.lclRate);
        setLclIncluded(result.lclRate !== null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ExtractionError ? e.message : "Couldn't read that circular. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // storagePath identifies the circular; re-running on every rerender would
    // re-call the AI needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circular.id]);

  function updateContainer(index: number, field: "type" | "sell" | "buy", value: string | number) {
    setContainers((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeContainer(index: number) {
    setContainers((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function addContainer() {
    setContainers((prev) => [...(prev ?? []), blankRow()]);
  }

  const flaggedCount = (containers ?? []).filter((c) => c.confidence === "needs_check").length
    + (lclIncluded && lclRate?.confidence === "needs_check" ? 1 : 0);

  async function handlePublish() {
    if (!containers || !origin.trim() || !destination.trim() || !carrier.trim()) {
      toast("Carrier, origin and destination are required before publishing.", "error");
      return;
    }
    setPublishing(true);
    try {
      await publishSeaTariffRow(
        {
          origin,
          destination,
          carrier,
          carrierCode,
          currency,
          containers,
          lclRate: lclIncluded ? lclRate : null,
        },
        uploadedBy,
      );
      toast(`Published ${origin} → ${destination} sea rates for ${carrier}.`, "success");
      onPublished();
      onClose();
    } catch {
      toast("Couldn't publish these rates. Try again.", "error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="mt-6 flex w-full max-w-6xl gap-4">
        {circular.downloadURL ? (
          <div className="hidden w-[360px] flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-xl lg:block">
            <div className="border-b border-[var(--color-border)] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Source document
            </div>
            <iframe src={circular.downloadURL} title="Source circular" className="h-[calc(100%-41px)] w-full" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-600" />
              <div>
                <div className="font-bold">Review extracted rates</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {circular.title || circular.fileName || "Circular"}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
              Reading the circular and pulling out the rates…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
              <div className="text-sm text-[var(--color-text-muted)]">{error}</div>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : containers ? (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--color-border)] px-6 py-3 text-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Detected</span>
                <label className="flex items-center gap-1.5">
                  Carrier
                  <input
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-40 rounded-md border border-[var(--color-border)] px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  Lane
                  <input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                    className="w-20 rounded-md border border-[var(--color-border)] px-2 py-1 text-sm uppercase"
                  />
                  →
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    className="w-20 rounded-md border border-[var(--color-border)] px-2 py-1 text-sm uppercase"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  Currency
                  <input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-16 rounded-md border border-[var(--color-border)] px-2 py-1 text-sm uppercase"
                  />
                </label>
                {sourcePage ? (
                  <span className="text-xs text-[var(--color-text-muted)]">from page {sourcePage}</span>
                ) : null}
              </div>

              {containers.length === 0 ? (
                <div className="flex items-center gap-2 bg-amber-50 px-6 py-2.5 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  No container rates were found on this page — add them below, or check this is the right circular.
                </div>
              ) : flaggedCount > 0 ? (
                <div className="flex items-center gap-2 bg-amber-50 px-6 py-2.5 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {flaggedCount} row{flaggedCount > 1 ? "s" : ""} need a quick check before you trust them.
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 px-6 py-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  All rates were read cleanly.
                </div>
              )}

              <div className="max-h-[42vh] overflow-y-auto px-6 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2">Container</th>
                      <th className="py-2">Sell</th>
                      <th className="py-2">Buy</th>
                      <th className="py-2">Confidence</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((c, i) => {
                      const flagged = c.confidence === "needs_check";
                      return (
                        <tr key={i} className={flagged ? "bg-amber-50/70" : undefined}>
                          <td className="border-t border-[var(--color-border)] py-2 font-semibold">
                            <select
                              value={c.type}
                              onChange={(e) => updateContainer(i, "type", e.target.value)}
                              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm"
                            >
                              {CONTAINER_TYPE_OPTIONS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-t border-[var(--color-border)] py-2">
                            <EmptyNumberInput
                              value={c.sell ?? 0}
                              onChange={(v) => updateContainer(i, "sell", v)}
                              className="w-24"
                              placeholder="Sell"
                            />
                          </td>
                          <td className="border-t border-[var(--color-border)] py-2">
                            <EmptyNumberInput
                              value={c.buy ?? 0}
                              onChange={(v) => updateContainer(i, "buy", v)}
                              className="w-24"
                              placeholder="Buy"
                            />
                          </td>
                          <td className="border-t border-[var(--color-border)] py-2">
                            {flagged ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                <AlertTriangle className="h-3 w-3" /> Needs check
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> High
                              </span>
                            )}
                            {c.note ? (
                              <div className="mt-1 text-xs text-[var(--color-text-muted)]">{c.note}</div>
                            ) : null}
                          </td>
                          <td className="border-t border-[var(--color-border)] py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeContainer(i)}
                              className="rounded-md p-1 text-rose-700 hover:bg-rose-50"
                              aria-label="Remove row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <button
                  type="button"
                  onClick={addContainer}
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add container type
                </button>

                <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-border)] pt-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={lclIncluded}
                      onChange={(e) => {
                        setLclIncluded(e.target.checked);
                        if (e.target.checked && !lclRate) {
                          setLclRate({ sell: null, buy: null, confidence: "high", note: "" });
                        }
                      }}
                    />
                    LCL rate
                  </label>
                  {lclIncluded ? (
                    <>
                      <EmptyNumberInput
                        value={lclRate?.sell ?? 0}
                        onChange={(v) => setLclRate((prev) => ({ ...(prev ?? { sell: null, buy: null, confidence: "high", note: "" }), sell: v }))}
                        className="w-24"
                        placeholder="Sell"
                      />
                      <EmptyNumberInput
                        value={lclRate?.buy ?? 0}
                        onChange={(v) => setLclRate((prev) => ({ ...(prev ?? { sell: null, buy: null, confidence: "high", note: "" }), buy: v }))}
                        className="w-24"
                        placeholder="Buy"
                      />
                      {lclRate?.confidence === "needs_check" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          <AlertTriangle className="h-3 w-3" /> Needs check
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">Not quoted on this circular</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-4">
                <div className="text-xs text-[var(--color-text-muted)]">
                  Nothing is saved to live rates until you publish.
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="secondary" onClick={onClose} disabled={publishing}>
                    Discard
                  </Button>
                  <Button type="button" onClick={() => void handlePublish()} disabled={publishing}>
                    {publishing ? "Publishing…" : "Publish to live rates"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
