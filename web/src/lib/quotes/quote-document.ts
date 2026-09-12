import type { SavedQuote } from "../types";
import { getQuoteRefId } from "./ref-id";
import { formatCurrency } from "../utils";
import { enquiryAssigneeLabel } from "../auth/desk-seats";
import {
  formatRoutingPreview,
  formatTransitPreview,
} from "../pricing/terms";
import {
  optionBreakdownsFromQuote,
  optionChargeLines,
  uniqueOptionBreakdowns,
  type OptionBreakdown,
} from "./option-breakdown";
import { compareHeading } from "./vendor-preview";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function optionFlags(option: OptionBreakdown): string {
  const bits: string[] = [];
  if (option.selected) bits.push("quoted offer");
  if (option.cheapest) bits.push("lowest");
  if (option.laneLabel) bits.push(option.laneLabel);
  return bits.join(" · ");
}

/** Quoted offer first, then the rest — client reads the pack top to bottom. */
export function orderOptionsForPack(options: OptionBreakdown[]): OptionBreakdown[] {
  return [...options].sort((a, b) => Number(b.selected) - Number(a.selected));
}

function optionListPlain(options: OptionBreakdown[], heading: string, cur: string): string[] {
  if (!options.length) return [];
  const lines = [heading];
  for (const option of options) {
    const flag = option.selected ? "quoted offer" : option.cheapest ? "lowest" : "alternative";
    lines.push(`• ${option.name}: ${formatCurrency(option.total, cur)} (${flag})`);
  }
  return lines;
}

export interface ClientQuoteDocument {
  ref: string;
  filename: string;
  pdfFilename: string;
  title: string;
  shareSubject: string;
  shareText: string;
  emailCover: string;
  html: string;
  optionCount: number;
}

export function buildClientQuoteDocument(quote: SavedQuote): ClientQuoteDocument {
  const ref = getQuoteRefId(quote);
  const options = orderOptionsForPack(uniqueOptionBreakdowns(optionBreakdownsFromQuote(quote)));
  const cur = quote.currency || "USD";
  const chw = Number(quote.details?.chargeableWeight ?? 0);
  const type = (quote.type || "").toLowerCase();
  const heading = compareHeading(type);
  const prepared = enquiryAssigneeLabel(quote.creator);
  const quoted = options.find((o) => o.selected) ?? options[0];
  const pdfFilename = `Quote-${ref}.pdf`;
  const title = `Quotation ${ref} · ${quote.customer || "Vertex"}`;
  const shareSubject = `Freight quotation ${ref} — ${quote.customer || ""}`.trim();

  const list = optionListPlain(options, heading, cur);
  const emailCover = [
    "ATLAS LOGISTICS",
    "Official Freight Quotation",
    "",
    `Ref: ${ref}`,
    `Customer: ${quote.customer || "—"}`,
    `Route: ${quote.route || "—"}`,
    `Date: ${quote.date || "—"}`,
    `Prepared by: ${prepared}`,
    "",
    ...(list.length ? [...list, ""] : []),
    options.length > 1
      ? "The attached PDF matches this quotation. It lists every airline option and the full charge breakup for each one."
      : "The attached PDF matches this quotation, including the charge breakup.",
  ].join("\n");

  const shareText = [
    `Atlas Logistics quotation ${ref}`,
    `Customer: ${quote.customer || "—"}`,
    `Route: ${quote.route || "—"}`,
    `Date: ${quote.date || "—"}`,
    "",
    ...list,
    "",
    options.length > 1
      ? "PDF attached — every airline’s breakup is on the document (quoted offer first)."
      : "PDF attached — official quotation with charge breakup.",
  ].join("\n");

  const compareRows = options
    .map(
      (option) => `<tr>
        <td><strong>${esc(option.name)}</strong></td>
        <td>${esc(optionFlags(option) || option.kindLabel)}</td>
        <td class="num">${esc(formatCurrency(option.total, cur))}</td>
      </tr>`,
    )
    .join("");

  const panels = options
    .map((option, index) => {
      const lines = optionChargeLines(option, cur, chw);
      const dl = lines
        .map((line, i) => {
          const last = i === lines.length - 1;
          return `<div class="row${last ? " total" : ""}"><span>${esc(line.label)}</span><strong>${esc(line.value)}</strong></div>`;
        })
        .join("");
      const routing = formatRoutingPreview(option.routing || "") || "—";
      const tt = formatTransitPreview(option.tt || "") || "—";
      const role = option.selected ? "quoted offer" : "alternative";
      return `<section class="panel${option.selected ? " quoted" : ""}">
        <p class="panel-kicker">${index + 1} of ${options.length} · ${esc(role)}</p>
        <h3>${esc(option.name)}${option.cheapest ? " ★ lowest" : ""}</h3>
        ${dl}
        <div class="row muted"><span>Routing</span><span>${esc(routing)}</span></div>
        <div class="row muted"><span>Transit time</span><span>${esc(tt)}</span></div>
        <div class="row muted"><span>Validity</span><span>${esc(option.validity || "—")}</span></div>
      </section>`;
    })
    .join("");

  const packHint =
    options.length > 1
      ? `<p class="hint">Every option below has its full breakup. Quoted offer is first. The client does not need our app to compare.</p>`
      : "";

  const terms = String(quote.details?.termsAndConditions ?? "").trim();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  @page { size: A4; margin: 14mm; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; color: #0f172a; background: #fff; }
  main { max-width: 720px; margin: 0 auto; padding: 8px 4px 28px; }
  h1 { font-size: 1.45rem; margin: 0.2rem 0 0; }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #2c2772; }
  .meta { color: #6a6478; font-size: 12px; }
  header { border-bottom: 3px solid #2c2772; padding-bottom: 14px; margin-bottom: 16px; }
  .brand-row { display: flex; align-items: flex-start; gap: 12px; }
  .brand-row img { width: 56px; height: 56px; border-radius: 999px; background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; color: #64748b; }
  .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .hint { font-size: 12px; color: #334155; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 12px; }
  .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 12px 0; break-inside: avoid; page-break-inside: avoid; }
  .panel.quoted { border-color: #6ee7b7; background: #f0fdf4; }
  .panel-kicker { margin: 0 0 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #047857; }
  .panel h3 { margin: 0 0 10px; font-size: 1.05rem; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 13px; }
  .row.total { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; font-weight: 800; color: #047857; }
  .muted { color: #64748b; }
  .total-box { background: #f8fafc; border-radius: 12px; padding: 16px; margin-top: 16px; }
  .total-box strong { display: block; font-size: 1.45rem; color: #047857; }
  pre { white-space: pre-wrap; font-size: 12px; color: #64748b; }
</style>
</head>
<body>
<main>
  <header>
    <div class="brand-row">
      <img src="/app/atlas-logo.png" width="56" height="56" alt="Atlas Logistics" />
      <div>
        <div class="brand">Atlas Logistics</div>
        <h1>Official Freight Quotation</h1>
        <p class="meta">Ref #${esc(ref)} · ${esc(quote.date || "—")} · Prepared by ${esc(prepared)}</p>
        <p class="meta">${esc(quote.customer || "—")} · ${esc(quote.route || "—")} · ${(quote.type || "").toUpperCase()}</p>
      </div>
    </div>
  </header>
  ${packHint}
  ${
    options.length
      ? `<table>
    <thead><tr><th>${esc(heading)}</th><th>Notes</th><th class="num">Sell total</th></tr></thead>
    <tbody>${compareRows}</tbody>
  </table>
  ${panels}`
      : `<p>No carrier options on this quotation.</p>`
  }
  <div class="total-box">
    <div class="meta">${options.length > 1 ? "Quoted offer total (client may choose another option above)" : "Quoted total"}</div>
    <strong>${esc(formatCurrency(Number(quote.amount ?? quoted?.total ?? 0), cur))}</strong>
  </div>
  ${
    terms
      ? `<h2>Terms &amp; conditions</h2><pre>${esc(terms)}</pre>`
      : ""
  }
</main>
</body>
</html>`;

  return {
    ref,
    filename: pdfFilename,
    pdfFilename,
    title,
    shareSubject,
    shareText,
    emailCover,
    html,
    optionCount: options.length,
  };
}
