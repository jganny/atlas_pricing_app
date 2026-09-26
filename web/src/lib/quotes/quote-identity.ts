import type { SavedQuote } from "../types";
import { formatCurrency } from "../utils";
import { enquiryAssigneeLabel } from "../auth/desk-seats";
import { getQuoteRefId } from "./ref-id";

export function statusLabel(status: string | undefined): string {
  const s = (status || "quoted").toLowerCase();
  if (s === "converted") return "Won booking";
  if (s === "lost") return "Lost";
  if (s === "cancelled") return "Cancelled";
  return "Quoted";
}

export function money(n: unknown, currency: string): string {
  return formatCurrency(Number(n ?? 0), currency);
}

/**
 * Shipment identity/detail rows — Customer, Route, Origin/Destination,
 * Incoterm, weights/CBM, etc., branched per desk type. Shared by the
 * on-screen "Quotation preview" panel and the printed/downloaded/emailed
 * quote document so both always show the same shipment facts — they must
 * never diverge into two independently-maintained field lists again.
 */
export function identityRows(quote: SavedQuote): Array<[string, string]> {
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
