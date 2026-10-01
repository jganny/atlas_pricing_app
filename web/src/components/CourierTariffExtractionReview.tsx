"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import {
  buildCourierTariffBookFromExtraction,
  type CourierExtractionResult,
  type CourierTariffBook,
  type CourierTariffDirection,
} from "@/lib/quotes/courier-tariff";
import { publishCourierTariffBook } from "@/lib/firebase/courier-tariffs";
import { CourierTariffBoard } from "@/components/CourierTariffBoard";
import {
  extractCourierTariffFromCircular,
  ExtractionError,
} from "@/lib/ai/circular-extraction";
import type { CircularRecord } from "@/lib/types";

export function CourierTariffExtractionReview({
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
  const [result, setResult] = useState<CourierExtractionResult | null>(null);
  const [direction, setDirection] = useState<CourierTariffDirection>("export");

  useEffect(() => {
    let cancelled = false;
    void extractCourierTariffFromCircular(circular.storagePath || "", circular.carrier)
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setDirection(res.direction);
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

  const book: CourierTariffBook | null = result
    ? buildCourierTariffBookFromExtraction(
        { ...result, direction },
        new Date().toISOString(),
        circular.fileName,
      )
    : null;

  const flaggedCount = result ? result.columns.filter((c) => c.confidence === "needs_check").length : 0;

  async function handlePublish() {
    if (!book || !book.lanes.length) {
      toast("No usable rate rows to publish.", "error");
      return;
    }
    setPublishing(true);
    try {
      if (useLiveData) {
        await publishCourierTariffBook(book, uploadedBy);
      }
      toast(`Published ${book.carrier} ${book.year} courier rates — ${book.lanes.length} lanes.`, "success");
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
          <div className="hidden w-[340px] flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-xl lg:block">
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
              Reading the weight/zone grid off the circular…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
              <div className="text-sm text-[var(--color-text-muted)]">{error}</div>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : book ? (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--color-border)] px-6 py-3 text-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Detected</span>
                <span className="font-semibold">{book.carrier}</span>
                <label className="flex items-center gap-1.5">
                  Direction
                  <Select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as CourierTariffDirection)}
                    className="w-32"
                  >
                    <option value="export">Export</option>
                    <option value="import">Import</option>
                    <option value="domestic">Domestic</option>
                  </Select>
                </label>
                <span>{book.currency}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {book.lanes.length} zone/countr{book.lanes.length === 1 ? "y" : "ies"} · up to {book.maxKg} kg
                </span>
                {result?.sourcePage ? (
                  <span className="text-xs text-[var(--color-text-muted)]">from page {result.sourcePage}</span>
                ) : null}
              </div>

              {!book.lanes.length ? (
                <div className="flex items-center gap-2 bg-amber-50 px-6 py-2.5 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  No usable rate columns were found — check this is a courier rate circular, or use the Excel importer instead.
                </div>
              ) : flaggedCount > 0 || book.warnings?.length ? (
                <div className="flex items-start gap-2 bg-amber-50 px-6 py-2.5 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    {flaggedCount > 0
                      ? `${flaggedCount} column${flaggedCount > 1 ? "s" : ""} need a quick check. `
                      : null}
                    {book.warnings?.join(" ")}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-50 px-6 py-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  All columns were read cleanly.
                </div>
              )}

              <div className="max-h-[48vh] overflow-y-auto px-6 py-3">
                <CourierTariffBoard book={book} />
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-4">
                <div className="text-xs text-[var(--color-text-muted)]">
                  Nothing is saved to live rates until you publish. Need to fix a number? Close this and use the
                  Excel importer, or re-run extraction after correcting the PDF.
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="secondary" onClick={onClose} disabled={publishing}>
                    Discard
                  </Button>
                  <Button type="button" onClick={() => void handlePublish()} disabled={publishing || !book.lanes.length}>
                    {publishing ? "Publishing…" : `Keep ${book.carrier} ${book.year} live for the year`}
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
