"use client";

import { Printer, X } from "lucide-react";
import type { SavedQuote } from "@/lib/types";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { Badge, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

function statusLabel(status: string | undefined) {
  const s = (status || "quoted").toLowerCase();
  if (s === "converted") return "Won booking";
  if (s === "lost") return "Lost";
  if (s === "cancelled") return "Cancelled";
  return "Quoted";
}

function detailRows(quote: SavedQuote): Array<[string, string]> {
  const d = quote.details ?? {};
  const type = (quote.type || "").toLowerCase();
  const rows: Array<[string, string]> = [
    ["Customer", quote.customer || "—"],
    ["Reference", getQuoteRefId(quote)],
    ["Status", statusLabel(quote.status)],
    ["Route", quote.route || "—"],
    ["Creator", quote.creator || "—"],
    ["Date", quote.date || "—"],
  ];

  if (type === "air") {
    rows.push(
      ["Origin", String(d.origin ?? "—")],
      ["Destination", String(d.destination ?? "—")],
      ["Airline", String(d.airline ?? "—")],
      ["Incoterm", String(d.incoterm ?? "—")],
      ["Commodity", String(d.commodity ?? "—")],
      ["Chargeable weight", `${Number(d.chargeableWeight ?? 0).toFixed(2)} kg`],
      ["Gross weight", `${Number(d.grossWeight ?? 0).toFixed(2)} kg`],
      ["Volume weight", `${Number(d.volumeWeight ?? 0).toFixed(2)} kg`],
      ["Base freight", formatCurrency(Number(d.baseFreight ?? quote.amount ?? 0), quote.currency)],
      ["Routing", String(d.routing ?? "—")],
      ["Transit time", String(d.tt ?? "—")],
      ["Validity", String(d.validity ?? "—")],
    );
  } else if (type === "sea") {
    rows.push(
      ["Origin", String(d.origin ?? "—")],
      ["Destination", String(d.destination ?? "—")],
      ["Liner", String(d.liner ?? d.shippingLine ?? "—")],
      ["Mode", String(d.type ?? d.module ?? "—").toUpperCase()],
      ["Incoterm", String(d.incoterm ?? "—")],
      ["Gross weight", `${Number(d.grossWeight ?? 0).toFixed(2)} kg`],
      ["Volume", `${Number(d.volumeCbm ?? d.volume ?? 0).toFixed(2)} CBM`],
      ["Chargeable RT", `${Number(d.chargeableRt ?? 0).toFixed(2)}`],
      ["Base freight", formatCurrency(Number(d.baseFreight ?? quote.amount ?? 0), quote.currency)],
      ["Routing", String(d.routing ?? "—")],
      ["Transit time", String(d.tt ?? "—")],
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
      ["Base freight", formatCurrency(Number(d.baseFreight ?? 0), quote.currency)],
      ["GST", formatCurrency(Number(d.gstAmount ?? 0), quote.currency)],
    );
  } else {
    rows.push(["Amount", formatCurrency(Number(quote.amount ?? 0), quote.currency)]);
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
  const terms = String(quote.details?.termsAndConditions ?? "");

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
              Print
            </Button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 print:p-8">
          <div className="mb-6 border-b-2 border-[var(--color-atlas-navy)] pb-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-atlas-navy)]">
              Atlas Pricing
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
              Freight Quotation
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
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
                  <td className="py-2 pr-4 font-semibold text-[var(--color-text-muted)] w-40">{label}</td>
                  <td className="py-2">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Grand total</div>
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
