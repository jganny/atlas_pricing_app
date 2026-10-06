"use client";

import { useMemo } from "react";
import { LineChart } from "lucide-react";
import { Card } from "@/components/ui";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { summarizeWinLoss, type WinLossQuery } from "@/lib/quotes/win-loss";
import type { EnquiryRecord } from "@/lib/types";

const NO_ENQUIRIES: EnquiryRecord[] = [];

function pct(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 50;
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100));
}

/**
 * "How this lane has gone" — a guide built only from this user's own past
 * quotes on the same lane. Quiet until there are enough decided quotes, and
 * never blocks or changes a price.
 */
export function WinLossPanel({
  mode,
  origin,
  destination,
  currency,
  currentRate,
}: WinLossQuery) {
  const { data } = useEnquiries();
  const enquiries = data ?? NO_ENQUIRIES;
  const summary = useMemo(
    () => summarizeWinLoss(enquiries, { mode, origin, destination, currency, currentRate }),
    [enquiries, mode, origin, destination, currency, currentRate],
  );

  if (!origin.trim() || !destination.trim() || !summary.enough) return null;

  const unit = mode === "air" ? "kg" : "RT";
  const { wonBand, lostBand } = summary;
  const hasBand = Boolean(wonBand || lostBand);
  const values = [wonBand?.min, wonBand?.max, lostBand?.min, lostBand?.max, currentRate ?? undefined].filter(
    (v): v is number => typeof v === "number" && v > 0,
  );
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const pad = (hi - lo) * 0.12 || 0.5;
  const dLo = lo - pad;
  const dHi = hi + pad;

  const positionText = {
    "in-wins": "You are priced in line with the quotes you have won.",
    between: "You are priced between your wins and your losses.",
    "in-losses": "You are priced in the range you have lost at before.",
    unknown: "",
  }[summary.position];

  return (
    <Card className="space-y-3 border-sky-200">
      <div>
        <h2 className="flex items-center gap-2 font-bold text-[var(--color-atlas-navy)]">
          <LineChart className="h-4 w-4 text-sky-700" />
          How this lane has gone
        </h2>
        <div className="text-xs text-[var(--color-text-muted)]">
          {origin} → {destination} · your quotes, last 12 months
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xl font-extrabold">{summary.winRatePct}%</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            won ({summary.won} of {summary.decided} decided)
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xl font-extrabold">{summary.open}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">still open</div>
        </div>
      </div>

      {hasBand ? (
        <div>
          <div className="mb-1 text-xs font-semibold">Price per {unit} on this lane</div>
          <div className="relative h-14">
            <div className="absolute inset-x-0 top-[22px] h-2.5 rounded-full bg-slate-200" />
            {wonBand ? (
              <div
                className="absolute top-[22px] h-2.5 rounded-full bg-emerald-600"
                style={{
                  left: `${pct(wonBand.min, dLo, dHi)}%`,
                  width: `${Math.max(2, pct(wonBand.max, dLo, dHi) - pct(wonBand.min, dLo, dHi))}%`,
                }}
              />
            ) : null}
            {lostBand ? (
              <div
                className="absolute top-[22px] h-2.5 rounded-full border-2 border-rose-600 bg-rose-100"
                style={{
                  left: `${pct(lostBand.min, dLo, dHi)}%`,
                  width: `${Math.max(2, pct(lostBand.max, dLo, dHi) - pct(lostBand.min, dLo, dHi))}%`,
                }}
              />
            ) : null}
            {typeof currentRate === "number" && currentRate > 0 ? (
              <div
                className="absolute top-1 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${pct(currentRate, dLo, dHi)}%` }}
              >
                <div className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  You {currentRate.toFixed(2)}
                </div>
                <div className="h-[18px] w-0.5 bg-slate-900" />
              </div>
            ) : null}
          </div>
          <div className="flex justify-between text-[10.5px] font-semibold">
            <span className="text-emerald-800">
              {wonBand ? `Won ${wonBand.min.toFixed(2)}–${wonBand.max.toFixed(2)}` : ""}
            </span>
            <span className="text-rose-800">
              {lostBand ? `Lost ${lostBand.min.toFixed(2)}–${lostBand.max.toFixed(2)}` : ""}
            </span>
          </div>
          {positionText ? <p className="mt-1.5 text-xs text-slate-700">{positionText}</p> : null}
          {summary.aboveWonCeiling ? (
            <p className="mt-1 text-xs text-slate-700">
              Quotes above {summary.aboveWonCeiling.rate.toFixed(2)}/{unit} were lost{" "}
              {summary.aboveWonCeiling.lost} time{summary.aboveWonCeiling.lost > 1 ? "s" : ""} out of{" "}
              {summary.aboveWonCeiling.total}.
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-1 border-t border-[var(--color-border)] pt-2 text-xs">
        {summary.recent.map((r) => (
          <li key={r.id} className="flex justify-between gap-2">
            <span>
              {r.month} · {r.customer}
            </span>
            <span className={r.outcome === "won" ? "font-semibold text-emerald-800" : "font-semibold text-rose-800"}>
              {r.outcome === "won" ? "✓ Won" : "✕ Lost"}
              {r.rate !== null ? ` · ${r.rate.toFixed(2)}` : ""}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">
        A guide from your own past quotes only — it never blocks or changes your price. Shows once a
        lane has 4 or more decided quotes.
      </p>
    </Card>
  );
}
