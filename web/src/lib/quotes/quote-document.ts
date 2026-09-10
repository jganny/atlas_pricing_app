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

function tabId(option: OptionBreakdown, index: number): string {
  const raw = `${option.id || "opt"}-${option.laneId || index}`;
  return `opt-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}-${index}`;
}

function optionFlags(option: OptionBreakdown): string {
  const bits: string[] = [];
  if (option.cheapest) bits.push("cheapest");
  if (option.selected) bits.push("quoted offer");
  if (option.laneLabel) bits.push(option.laneLabel);
  return bits.join(" · ");
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
  const options = uniqueOptionBreakdowns(optionBreakdownsFromQuote(quote));
  const cur = quote.currency || "USD";
  const chw = Number(quote.details?.chargeableWeight ?? 0);
  const type = (quote.type || "").toLowerCase();
  const heading = compareHeading(type);
  const prepared = enquiryAssigneeLabel(quote.creator);
  const quoted = options.find((o) => o.selected) ?? options[0];
  const filename = `Quote-${ref}.html`;
  const pdfFilename = `Quote-${ref}.pdf`;
  const title = `Quotation ${ref} · ${quote.customer || "Vertex"}`;
  const shareSubject = `Freight quotation ${ref} — ${quote.customer || ""}`.trim();
  const emailCover = [
    "Please find our official freight quotation attached as PDF.",
    "",
    `Ref: ${ref}`,
    `Customer: ${quote.customer || "—"}`,
  ].join("\n");

  const shareLines = [
    `Atlas Logistics quotation ${ref}`,
    `Customer: ${quote.customer || "—"}`,
    `Route: ${quote.route || "—"}`,
    `Date: ${quote.date || "—"}`,
  ];
  if (options.length > 1) {
    shareLines.push("", `${heading} — your client can pick any option:`);
    for (const option of options) {
      const flag = option.selected ? "quoted offer" : option.cheapest ? "lowest" : "alternative";
      shareLines.push(
        `• ${option.name}: ${formatCurrency(option.total, cur)} (${flag})`,
      );
    }
    shareLines.push(
      "",
      "A PDF cannot switch airlines. Attach the downloaded Quote HTML — the client taps each airline to compare breakups, then Print → Save as PDF if they want paper.",
    );
  } else if (quoted) {
    shareLines.push(`Amount: ${formatCurrency(quoted.total || Number(quote.amount ?? 0), cur)}`);
  }
  const shareText = shareLines.join("\n");

  const compareRows = options
    .map((option, index) => {
      const id = tabId(option, index);
      return `<tr>
        <td><button type="button" class="tab" data-tab="${esc(id)}"${index === 0 ? " data-active" : ""}>${esc(option.name)}</button></td>
        <td>${esc(optionFlags(option) || option.kindLabel)}</td>
        <td class="num">${esc(formatCurrency(option.total, cur))}</td>
      </tr>`;
    })
    .join("");

  const panels = options
    .map((option, index) => {
      const id = tabId(option, index);
      const lines = optionChargeLines(option, cur, chw);
      const dl = lines
        .map((line, i) => {
          const last = i === lines.length - 1;
          return `<div class="row${last ? " total" : ""}"><span>${esc(line.label)}</span><strong>${esc(line.value)}</strong></div>`;
        })
        .join("");
      const routing = formatRoutingPreview(option.routing || "") || "—";
      const tt = formatTransitPreview(option.tt || "") || "—";
      return `<section class="panel" id="${esc(id)}"${index === 0 ? "" : " hidden"}>
        <h3>${esc(option.name)}${option.cheapest ? " ★" : ""}${option.selected ? " · quoted offer" : " · alternative"}</h3>
        ${dl}
        <div class="row muted"><span>Routing</span><span>${esc(routing)}</span></div>
        <div class="row muted"><span>Transit time</span><span>${esc(tt)}</span></div>
        <div class="row muted"><span>Validity</span><span>${esc(option.validity || "—")}</span></div>
      </section>`;
    })
    .join("");

  const switchHint =
    options.length > 1
      ? `<p class="hint">Tap an airline below to see that breakup. Print / Save PDF lists <strong>every</strong> option so the client can compare without our app.</p>`
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
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; color: #0f172a; background: #fff; }
  main { max-width: 800px; margin: 0 auto; padding: 28px 22px 48px; }
  h1 { font-size: 1.6rem; margin: 0.2rem 0 0; }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #1e1b4b; }
  .meta { color: #64748b; font-size: 12px; }
  header { border-bottom: 3px solid #1e1b4b; padding-bottom: 16px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; color: #64748b; }
  .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .tab { background: none; border: 0; padding: 0; font: inherit; font-weight: 800; color: #1e1b4b; cursor: pointer; text-decoration: underline; }
  .tab[data-active] { text-decoration: none; }
  .hint { font-size: 13px; color: #334155; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 12px; }
  .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 14px 0; }
  .panel h3 { margin: 0 0 10px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 14px; }
  .row.total { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; font-weight: 800; color: #047857; }
  .muted { color: #64748b; }
  .total-box { background: #f8fafc; border-radius: 12px; padding: 16px; margin-top: 18px; }
  .total-box strong { display: block; font-size: 1.6rem; color: #047857; }
  pre { white-space: pre-wrap; font-size: 12px; color: #64748b; }
  @media print, screen {
    body.pdf-pack .hint, body.pdf-pack .no-print { display: none !important; }
    body.pdf-pack .panel { display: block !important; page-break-inside: avoid; }
    body.pdf-pack .tab { text-decoration: none; cursor: default; }
  }
  @media print {
    .hint, .no-print { display: none !important; }
    .tab { text-decoration: none; cursor: default; }
    .panel { display: block !important; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <header>
    <div class="brand">Atlas Logistics</div>
    <h1>Official Freight Quotation</h1>
    <p class="meta">Ref #${esc(ref)} · ${esc(quote.date || "—")} · Prepared by ${esc(prepared)}</p>
    <p class="meta">${esc(quote.customer || "—")} · ${esc(quote.route || "—")} · ${(quote.type || "").toUpperCase()}</p>
  </header>
  ${switchHint}
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
<script>
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-tab]"));
  if (tabs.length < 2) return;
  function show(id) {
    tabs.forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === id;
      if (on) btn.setAttribute("data-active", "");
      else btn.removeAttribute("data-active");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".panel"), function (panel) {
      panel.hidden = panel.id !== id;
    });
  }
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () { show(btn.getAttribute("data-tab")); });
  });
})();
</script>
</body>
</html>`;

  return {
    ref,
    filename,
    pdfFilename,
    title,
    shareSubject,
    shareText,
    emailCover,
    html,
    optionCount: options.length,
  };
}
