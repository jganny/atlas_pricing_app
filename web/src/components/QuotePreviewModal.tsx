"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Mail, MessageCircle, Printer, X } from "lucide-react";
import type { SavedQuote } from "@/lib/types";
import { toast } from "@/components/Toast";
import { GuideNote } from "@/components/GuideNote";
import { buildClientQuoteDocument } from "@/lib/quotes/quote-document";
import {
  downloadBlob,
  emailQuotePdf,
  htmlDocumentToPdfFile,
  openWhatsApp,
  printHtmlDocument,
  shareQuotePdf,
} from "@/lib/quotes/quote-print";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import { Badge, Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import {
  formatRoutingPreview,
  formatTransitPreview,
} from "@/lib/pricing/terms";
import { enquiryAssigneeLabel } from "@/lib/auth/desk-seats";
import {
  compareHeading,
  quotedFieldLabel,
  vendorRowsFromQuote,
} from "@/lib/quotes/vendor-preview";
import {
  optionBreakdownsFromQuote,
  optionChargeLines,
  uniqueOptionBreakdowns,
  type OptionBreakdown,
} from "@/lib/quotes/option-breakdown";
import { VendorCompareList } from "@/components/VendorCompareList";

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

function identityRows(quote: SavedQuote): Array<[string, string]> {
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

  const quotedLanes = Array.isArray(d.quotedLanes) ? d.quotedLanes : [];
  if (quotedLanes.length > 1) {
    rows.push(["Lanes", `${quotedLanes.length} origin → destination pairs`]);
    quotedLanes.forEach((raw) => {
      const lane = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const label = String(lane.laneLabel ?? "Lane");
      const name = String(lane.airline ?? "—");
      const amt = money(lane.amount, cur);
      const validity = String(lane.validity ?? "").trim();
      rows.push([label, `${name} · ${amt}${validity ? ` · valid ${validity}` : ""}`]);
    });
    rows.push(["All lanes total", money(d.allLanesTotal ?? quote.amount, cur)]);
  } else if (type === "air" || type === "sea" || type === "transport") {
    rows.push(
      ["Origin", String(d.origin ?? "—")],
      ["Destination", String(d.destination ?? "—")],
    );
  }

  if (type === "air") {
    rows.push(
      ["Incoterm", String(d.incoterm ?? "—")],
      ["Commodity", String(d.commodity ?? "—")],
      ["Chargeable weight", `${Number(d.chargeableWeight ?? 0).toFixed(2)} kg`],
      ["Gross weight", `${Number(d.grossWeight ?? 0).toFixed(2)} kg`],
      ["Volume weight", `${Number(d.volumeWeight ?? 0).toFixed(2)} kg`],
    );
  } else if (type === "sea") {
    rows.push(
      ["Mode", String(d.type ?? d.module ?? "—").toUpperCase()],
      ["Incoterm", String(d.incoterm ?? "—")],
      ["Gross weight", `${Number(d.grossWeight ?? 0).toFixed(2)} kg`],
      ["Volume", `${Number(d.volumeCbm ?? d.volume ?? 0).toFixed(2)} CBM`],
    );
  } else if (type === "courier") {
    rows.push(
      ["Origin", `${d.originCity ?? d.origin ?? ""} (${d.originCountry ?? ""})`],
      ["Destination", `${d.destCity ?? d.destination ?? ""} (${d.destCountry ?? ""})`],
      ["Service", String(d.service ?? "—")],
      ["Chargeable", `${Number(d.chargeableWeight ?? 0).toFixed(2)} kg`],
      ["Zone", String(d.zone ?? "—")],
    );
  } else if (type === "transport") {
    rows.push(
      ["Vehicle", String(d.vehicleType ?? "—")],
      ["Service", String(d.serviceType ?? "—")],
    );
  } else if (type === "warehouse") {
    rows.push(
      ["Location", String(d.location ?? quote.route ?? "—")],
      ["Storage type", String(d.storageType ?? "—")],
      ["CBM", String(d.cbm ?? "—")],
      ["Days", String(d.days ?? "—")],
    );
  } else if (quotedLanes.length <= 1) {
    rows.push(["Amount", money(quote.amount, cur)]);
  }

  if (quotedLanes.length <= 1 && String(d.validity ?? "").trim()) {
    rows.push(["Validity", String(d.validity)]);
  }

  if (quote.notes) rows.push(["Notes", quote.notes]);
  return rows;
}

function BreakdownPanel({
  option,
  currency,
  chargeableWeight,
  heading,
}: {
  option: OptionBreakdown;
  currency: string;
  chargeableWeight: number;
  heading: string;
}) {
  const kind = (option.kind || "").toLowerCase();
  const isTrucker = kind === "trucker" || kind === "transport";
  const isWarehouse = kind === "warehouse" || kind === "storage";
  const showRouting = !isTrucker && !isWarehouse;
  const lines = optionChargeLines(option, currency, chargeableWeight);
  const body = lines.slice(0, -1);
  const total = lines[lines.length - 1];
  return (
    <div className="rounded-lg border border-slate-200 p-4 text-sm" data-testid="quote-option-breakup">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {heading}
      </div>
      <div className="mb-3 font-extrabold text-[var(--color-atlas-navy)]">
        {option.name}
        {option.cheapest ? " ★" : ""}
        {option.selected ? " · quoted" : ""}
        {option.laneLabel ? ` · ${option.laneLabel}` : ""}
      </div>
      <dl className="space-y-1.5">
        {body.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt>{line.label}</dt>
            <dd className="font-semibold">{line.value}</dd>
          </div>
        ))}
        {total ? (
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-1.5">
            <dt>{total.label}</dt>
            <dd className="font-extrabold text-emerald-700">{total.value}</dd>
          </div>
        ) : null}
        {showRouting ? (
          <>
            <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
              <dt>Routing</dt>
              <dd>{formatRoutingPreview(option.routing || "") || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
              <dt>Transit time</dt>
              <dd>{formatTransitPreview(option.tt || "") || "—"}</dd>
            </div>
          </>
        ) : null}
        <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
          <dt>Validity</dt>
          <dd data-testid="quote-option-validity">{option.validity || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function QuotePreviewModal({
  quote,
  onClose,
}: {
  quote: SavedQuote;
  onClose: () => void;
}) {
  const ref = getQuoteRefId(quote);
  const vendors = vendorRowsFromQuote(quote);
  const options = uniqueOptionBreakdowns(optionBreakdownsFromQuote(quote));
  const quoted = vendors.find((v) => v.selected) ?? vendors[0];
  const cheapest = vendors.find((v) => v.cheapest);
  const [inspectId, setInspectId] = useState(quoted?.id ?? options[0]?.id ?? "");

  useEffect(() => {
    setInspectId(quoted?.id ?? "");
  }, [quote.id, quoted?.id]);

  const inspected = useMemo(
    () => options.find((o) => o.id === inspectId) ?? options.find((o) => o.selected) ?? options[0],
    [options, inspectId],
  );

  const rows = identityRows(quote);
  const terms = String(quote.details?.termsAndConditions ?? "");
  const type = (quote.type || "").toLowerCase();
  const d = quote.details ?? {};
  const quotedLanes = Array.isArray(d.quotedLanes) ? d.quotedLanes : [];
  const multiLane = quotedLanes.length > 1;
  const showCompare = vendors.length > 1;
  const quotedIsNotCheapest =
    !multiLane && Boolean(cheapest && quoted && cheapest.id !== quoted.id && cheapest.total > 0);
  const cur = quote.currency || "USD";
  const chw = Number(d.chargeableWeight ?? 0);
  const inspectable = type === "air" || type === "sea" || options.length > 0;
  const clientDoc = useMemo(() => buildClientQuoteDocument(quote), [quote]);
  const [shareBusy, setShareBusy] = useState<string | null>(null);

  async function handlePrint() {
    setShareBusy("Opening printer…");
    try {
      await printHtmlDocument(clientDoc.html);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Print failed", "error");
    } finally {
      setShareBusy(null);
    }
  }

  async function pdfFile() {
    return htmlDocumentToPdfFile(clientDoc.html, clientDoc.pdfFilename);
  }

  async function handleDownload() {
    setShareBusy("Preparing PDF…");
    try {
      const file = await pdfFile();
      downloadBlob(file.name, file);
      toast("PDF saved — every airline breakup is on the document.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not prepare the quotation PDF", "error");
    } finally {
      setShareBusy(null);
    }
  }

  async function handleEmail() {
    setShareBusy("Preparing PDF…");
    try {
      const file = await pdfFile();
      const how = await emailQuotePdf({
        file,
        subject: clientDoc.shareSubject,
        cover: clientDoc.emailCover,
      });
      toast(
        how === "shared"
          ? "Choose Mail — the quotation PDF is attached."
          : "PDF downloaded. Open the .eml draft (PDF is attached) or drop the PDF onto a new mail.",
        "success",
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast(err instanceof Error ? err.message : "Could not prepare the quotation PDF", "error");
    } finally {
      setShareBusy(null);
    }
  }

  async function handleWhatsApp() {
    setShareBusy("Preparing PDF…");
    try {
      const file = await pdfFile();
      const how = await shareQuotePdf({
        file,
        subject: clientDoc.shareSubject,
        text: clientDoc.shareText,
      });
      if (how === "downloaded") openWhatsApp(clientDoc.shareText);
      toast(
        how === "shared"
          ? "Pick WhatsApp — the quotation PDF goes with the message."
          : "PDF saved. Attach Quote-….pdf in the WhatsApp chat that just opened.",
        "success",
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast(err instanceof Error ? err.message : "Could not prepare the quotation PDF", "error");
    } finally {
      setShareBusy(null);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        void handlePrint();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clientDoc.html]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:relative print:inset-auto print:bg-white print:p-0">
      <div
        data-testid="quote-preview-modal"
        className="quote-print-root my-4 w-full max-w-3xl rounded-xl bg-white shadow-xl print:my-0 print:max-w-none print:shadow-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">Quotation preview</h2>
            <p className="text-xs text-[var(--color-text-muted)]">#{ref} · {quote.customer}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              data-testid="quote-print-btn"
              onClick={() => void handlePrint()}
              disabled={Boolean(shareBusy)}
            >
              <Printer className="mr-2 h-4 w-4" />
              {shareBusy || "Print / Save PDF"}
            </Button>
            <button type="button" data-modal-close onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 print:p-8">
          <div className="mb-4 flex flex-wrap gap-2 print:hidden" data-testid="quote-share-bar">
            <Button type="button" variant="secondary" className="text-xs" data-testid="quote-download-btn" onClick={() => void handleDownload()} disabled={Boolean(shareBusy)}>
              <Download className="mr-1 h-4 w-4" />
              Download quote
            </Button>
            <Button type="button" variant="secondary" className="text-xs" data-testid="quote-email-btn" onClick={() => void handleEmail()} disabled={Boolean(shareBusy)}>
              <Mail className="mr-1 h-4 w-4" />
              {shareBusy === "Preparing PDF…" ? "Preparing PDF…" : "Email"}
            </Button>
            <Button type="button" variant="secondary" className="text-xs" data-testid="quote-whatsapp-btn" onClick={() => void handleWhatsApp()} disabled={Boolean(shareBusy)}>
              <MessageCircle className="mr-1 h-4 w-4" />
              WhatsApp
            </Button>
          </div>
          <GuideNote testId="quote-share-guide">
            {options.length > 1
              ? "Email, WhatsApp, and Download all send one PDF: comparison table plus the full breakup for every airline (quoted offer first). Print / Save PDF is the same pack."
              : "Email, WhatsApp, and Download send the official quotation as a PDF. Print / Save PDF is the same page on paper."}
          </GuideNote>
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
              {cheapest && showCompare && !multiLane ? (
                <Badge tone="success">Cheapest ★ {cheapest.name}</Badge>
              ) : null}
              {multiLane ? (
                <Badge tone="info">{quotedLanes.length} lanes on this quote</Badge>
              ) : null}
            </div>
          </div>

          {showCompare ? (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 print:hidden">
              <VendorCompareList
                vendors={vendors}
                currency={cur}
                heading={compareHeading(type)}
                hint="Click any option to inspect the breakup here. Quoted is our recommended offer — the client still receives every airline to compare."
                onSelect={setInspectId}
                activeId={inspectId}
                testId="quote-preview-vendors"
              />
            </div>
          ) : null}

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

          {inspectable && inspected ? (
            <div className="quote-print-screen-only mb-4 print:hidden" data-testid="quote-screen-breakup">
              <BreakdownPanel
                option={inspected}
                currency={cur}
                chargeableWeight={chw}
                heading={
                  inspected.selected
                    ? `Charges to customer · ${quotedFieldLabel(type)}`
                    : `Inspecting ${inspected.name} (not the quoted option)`
                }
              />
            </div>
          ) : type === "air" || type === "sea" ? (
            <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Charges to customer (quoted option)
              </div>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt>Base freight</dt>
                  <dd className="font-semibold">{money(d.baseFreight, cur)}</dd>
                </div>
                {Number(d.originFeesTotal ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>Origin fees</dt>
                    <dd className="font-semibold">{money(d.originFeesTotal, cur)}</dd>
                  </div>
                ) : null}
                {type === "air" && Number(d.amsFee ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>AMS</dt>
                    <dd className="font-semibold">{money(d.amsFee, cur)}</dd>
                  </div>
                ) : null}
                {Number(d.destFeesTotal ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>Destination fees</dt>
                    <dd className="font-semibold">{money(d.destFeesTotal, cur)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          {inspectable && options.length > 0 ? (
            <div className="quote-print-pack mb-6 hidden space-y-4 print:block" data-testid="quote-print-pack">
              <h3 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                {options.length === 1 ? "Charges to customer" : "Charge pack · every option"}
              </h3>
              {options.length > 1 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Each option is printed once so the client can compare without opening the app.
                </p>
              ) : null}
              {options.map((option) => (
                <BreakdownPanel
                  key={`print-${option.id}`}
                  option={option}
                  currency={cur}
                  chargeableWeight={chw}
                  heading={
                    option.selected
                      ? `Quoted option${option.laneLabel ? ` · ${option.laneLabel}` : ""}`
                      : `Alternative${option.laneLabel ? ` · ${option.laneLabel}` : ""}`
                  }
                />
              ))}
            </div>
          ) : null}

          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
              {multiLane
                ? "Quoted total · all lanes"
                : `Quoted total${quoted ? ` · ${quoted.name}` : ""}${quoted?.cheapest ? " ★" : ""}`}
            </div>
            <div className="text-2xl font-extrabold text-emerald-700" data-testid="quote-preview-total">
              {formatCurrency(Number(quote.amount ?? quoted?.total ?? 0), quote.currency)}
            </div>
            {multiLane ? (
              <ul className="mt-2 space-y-1 text-sm" data-testid="quote-preview-lanes">
                {quotedLanes.map((raw, i) => {
                  const lane = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
                  const laneId = String(lane.laneId ?? i);
                  const quotedOnLane = options.find((o) => o.selected && (o.laneId === laneId || o.laneLabel === String(lane.laneLabel ?? "")));
                  return (
                    <li key={laneId}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-white print:hover:bg-transparent"
                        onClick={() => quotedOnLane && setInspectId(quotedOnLane.id)}
                      >
                        <span>
                          {String(lane.laneLabel ?? `Lane ${i + 1}`)} · {String(lane.airline ?? "—")}
                          {String(lane.validity ?? "").trim()
                            ? ` · valid ${String(lane.validity)}`
                            : quotedOnLane?.validity
                              ? ` · valid ${quotedOnLane.validity}`
                              : ""}
                        </span>
                        <span className="font-semibold">{money(lane.amount, cur)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {quotedIsNotCheapest && cheapest ? (
              <div className="mt-2 text-sm font-semibold text-emerald-800" data-testid="quote-preview-cheapest-note">
                Cheapest option: {cheapest.name} ★ {money(cheapest.total, cur)} — click it above to
                open that breakup.
              </div>
            ) : null}
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
