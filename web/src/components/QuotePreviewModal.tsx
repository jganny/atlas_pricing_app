"use client";

import { Printer, X } from "lucide-react";
import type { SavedQuote } from "@/lib/types";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { Badge, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  formatRoutingPreview,
  formatTransitPreview,
} from "@/lib/pricing/terms";
import { enquiryAssigneeLabel } from "@/lib/auth/desk-seats";
import { vendorRowsFromQuote } from "@/lib/quotes/vendor-preview";

function statusLabel(status: string | undefined) {
  const s = (status || "quoted").toLowerCase();
  if (s === "converted") return "Won booking";
  if (s === "lost") return "Lost";
  if (s === "cancelled") return "Cancelled";
  return "Quoted";
}

function money(n: unknown, currency: string) {
  return formatCurrency(Number(n ?? 0), currency);
}

function detailRows(quote: SavedQuote): Array<[string, string]> {
  const d = quote.details ?? {};
  const type = (quote.type || "").toLowerCase();
  const cur = quote.currency || "USD";
  const rows: Array<[string, string]> = [
    ["Customer", quote.customer || "—"],
    ["Reference", getQuoteRefId(quote)],
    ["Status", statusLabel(quote.status)],
    ["Route", quote.route || "—"],
    ["Creator", enquiryAssigneeLabel(quote.creator)],
    ["Date", quote.date || "—"],
  ];

  if (type === "air") {
    const chw = Number(d.chargeableWeight ?? 0);
    const rate = Number(d.appliedRate ?? 0);
    const base = Number(d.baseFreight ?? 0);
    const originFees = Number(d.originFeesTotal ?? 0);
    const destFees = Number(d.destFeesTotal ?? 0);
    const ams = Number(d.amsFee ?? 0);
    rows.push(
      ["Origin", String(d.origin ?? "—")],
      ["Destination", String(d.destination ?? "—")],
      ["Airline", String(d.airline ?? "—")],
      ["Incoterm", String(d.incoterm ?? "—")],
      ["Commodity", String(d.commodity ?? "—")],
      ["Chargeable weight", `${chw.toFixed(2)} kg`],
      ["Gross weight", `${Number(d.grossWeight ?? 0).toFixed(2)} kg`],
      ["Volume weight", `${Number(d.volumeWeight ?? 0).toFixed(2)} kg`],
      [
        "Base freight",
        rate > 0 && chw > 0
          ? `${chw.toFixed(2)} kg × ${money(rate, cur)} = ${money(base, cur)}`
          : money(base, cur),
      ],
    );
    if (originFees > 0) rows.push(["Origin fees", money(originFees, cur)]);
    if (ams > 0) rows.push(["AMS", money(ams, cur)]);
    if (destFees > 0) rows.push(["Destination fees", money(destFees, cur)]);
    rows.push(
      ["Routing", formatRoutingPreview(String(d.routing ?? "")) || "—"],
      ["Transit time", formatTransitPreview(String(d.tt ?? "")) || "—"],
      ["Validity", String(d.validity ?? "—")],
    );
  } else if (type === "sea") {
    const rt = Number(d.chargeableRt ?? 0);
    const base = Number(d.baseFreight ?? 0);
    const originFees = Number(d.originFeesTotal ?? 0);
    const destFees = Number(d.destFeesTotal ?? 0);
    const override = Number(d.chargeableCbmOverride ?? 0);
    rows.push(
      ["Origin", String(d.origin ?? "—")],
      ["Destination", String(d.destination ?? "—")],
      ["Liner", String(d.liner ?? d.shippingLine ?? "—")],
      ["Mode", String(d.type ?? d.module ?? "—").toUpperCase()],
      ["Incoterm", String(d.incoterm ?? "—")],
      ["Gross weight", `${Number(d.grossWeight ?? 0).toFixed(2)} kg`],
      ["Volume", `${Number(d.volumeCbm ?? d.volume ?? 0).toFixed(2)} CBM`],
      [
        "Chargeable RT",
        override > 0 ? `${rt.toFixed(2)} (manual override ${override.toFixed(2)})` : `${rt.toFixed(2)}`,
      ],
      ["Base freight", money(base, cur)],
    );
    if (originFees > 0) rows.push(["Origin fees", money(originFees, cur)]);
    if (destFees > 0) rows.push(["Destination fees", money(destFees, cur)]);
    rows.push(
      ["Routing", formatRoutingPreview(String(d.routing ?? "")) || "—"],
      ["Transit time", formatTransitPreview(String(d.tt ?? "")) || "—"],
      ["Validity", String(d.validity ?? "—")],
    );
    const summary = d.containerSummary as string[] | undefined;
    if (summary?.length) {
      rows.push(["Containers", summary.join(", ")]);
    }
  } else if (type === "courier") {
    rows.push(
      ["Origin", `${d.originCity ?? ""} (${d.originCountry ?? ""})`],
      ["Destination", `${d.destCity ?? ""} (${d.destCountry ?? ""})`],
      ["Service", String(d.service ?? "—")],
      ["Carrier", String(d.carrierName ?? d.carrier ?? "—")],
      ["Chargeable", `${Number(d.chargeableWeight ?? 0).toFixed(2)} kg`],
      ["Zone", String(d.zone ?? "—")],
      ["Base freight", money(d.baseFreight, cur)],
      ["GST", money(d.gstAmount, cur)],
    );
  } else {
    rows.push(["Amount", money(quote.amount, cur)]);
  }

  if (quote.notes) rows.push(["Notes", quote.notes]);
  return rows;
}

export function QuotePreviewModal({
  quote,
  onClose,
}: {
  quote: SavedQuote;
  onClose: () => void;
}) {
  const ref = getQuoteRefId(quote);
  const rows = detailRows(quote);
  const vendors = vendorRowsFromQuote(quote);
  const terms = String(quote.details?.termsAndConditions ?? "");
  const type = (quote.type || "").toLowerCase();
  const d = quote.details ?? {};
  const showAirBreakdown = type === "air";
  const showSeaBreakdown = type === "sea";

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:relative print:inset-auto print:bg-white print:p-0">
      <div className="quote-print-root my-4 w-full max-w-3xl rounded-xl bg-white shadow-xl print:my-0 print:max-w-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">Quotation preview</h2>
            <p className="text-xs text-[var(--color-text-muted)]">#{ref} · {quote.customer}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Button>
            <button type="button" data-modal-close onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 print:p-8">
          <div className="mb-6 border-b-2 border-[var(--color-atlas-navy)] pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-atlas-navy)]">
                  Atlas Logistics
                </div>
                <h1 className="mt-1 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
                  Official Freight Quotation
                </h1>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  This quotation is subject to carrier space and the terms below.
                </p>
              </div>
              <div className="text-right text-xs text-[var(--color-text-muted)]">
                <div>Ref #{ref}</div>
                <div>{quote.date || "—"}</div>
                <div>Prepared by {enquiryAssigneeLabel(quote.creator)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">#{ref}</Badge>
              <Badge
                tone={
                  quote.status === "converted"
                    ? "success"
                    : quote.status === "quoted"
                      ? "warn"
                      : "neutral"
                }
              >
                {statusLabel(quote.status)}
              </Badge>
              <Badge tone="neutral">{(quote.type || "").toUpperCase()}</Badge>
            </div>
          </div>

          <table className="mb-6 w-full text-sm">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="w-40 py-2 pr-4 font-semibold text-[var(--color-text-muted)]">{label}</td>
                  <td className="py-2">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {vendors.length > 0 ? (
            <div className="mb-6">
              <h3 className="mb-1 text-sm font-extrabold text-[var(--color-atlas-navy)]">
                Carrier options
              </h3>
              <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                ★ is the cheapest total. Quoted is the option on this document.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="py-1.5">Option</th>
                    <th className="py-1.5">Role</th>
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr
                      key={v.id}
                      className={
                        v.cheapest
                          ? "bg-emerald-50 font-semibold"
                          : v.selected
                            ? "bg-sky-50"
                            : ""
                      }
                    >
                      <td className="py-1.5">
                        {v.name}
                        {v.cheapest ? " ★" : ""}
                      </td>
                      <td className="py-1.5 text-xs text-[var(--color-text-muted)]">
                        {v.selected ? "Quoted" : v.kind}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {money(v.total, quote.currency || "USD")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {(showAirBreakdown || showSeaBreakdown) && (
            <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Charges to customer
              </div>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt>Base freight</dt>
                  <dd className="font-semibold">{money(d.baseFreight, quote.currency || "USD")}</dd>
                </div>
                {Number(d.originFeesTotal ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>Origin fees</dt>
                    <dd className="font-semibold">{money(d.originFeesTotal, quote.currency || "USD")}</dd>
                  </div>
                ) : null}
                {showAirBreakdown && Number(d.amsFee ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>AMS</dt>
                    <dd className="font-semibold">{money(d.amsFee, quote.currency || "USD")}</dd>
                  </div>
                ) : null}
                {Number(d.destFeesTotal ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>Destination fees</dt>
                    <dd className="font-semibold">{money(d.destFeesTotal, quote.currency || "USD")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Customer total</div>
            <div className="text-2xl font-extrabold text-emerald-700">
              {formatCurrency(Number(quote.amount ?? 0), quote.currency)}
            </div>
            {quote.grossProfit != null ? (
              <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                Gross profit: {formatCurrency(quote.grossProfit, quote.grossProfitCurrency ?? quote.currency)}
              </div>
            ) : null}
          </div>

          {terms ? (
            <div className="mt-6">
              <h3 className="mb-2 font-bold text-[var(--color-atlas-navy)]">Terms & conditions</h3>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-text-muted)]">
                {terms}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
