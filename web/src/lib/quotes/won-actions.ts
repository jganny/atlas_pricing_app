/**
 * One-tap Won from Enquiry DB, for quotes made on the Air Nom or Sea Nom desks.
 * It does exactly what the Won form does with every detail left blank: the quote becomes Won, its blanks (shipper,
 * consignee, commodity, rates) are tracked in Won follow-ups, and the NRS desk gets the follow-up, the alert and the
 * directory entry, so they can fill in the rest and follow up with the customer.
 */
import { belongsToViewersDesk, quoteDeskSeatId } from "@/lib/auth/desk-seats";
import { convertQuoteToWon, fetchQuoteById, patchQuote } from "@/lib/firebase/quote-lifecycle";
import { deleteNrsRegistryEntry, saveNrsRegistryEntry } from "@/lib/firebase/nrs-registry";
import { deleteWonFollowUp, upsertWonFollowUp } from "@/lib/firebase/won-followups";
import { pushNrsAlert, pushNrsFollowUp, withdrawNrsHandover } from "@/lib/quotes/nrs-alerts";
import { buildRegistryEntry } from "@/lib/quotes/nrs-registry";
import { getQuoteRefId } from "@/lib/quotes/ref-id";
import type { EnquiryRecord } from "@/lib/types";

const NOMINATION_SEATS = ["air-nom", "sea-nom"];

/**
 * Whether the NRS directory lists the booking as Air or Sea. It follows the shipment itself: since the two nomination desks
 * cover each other, an Air Nom user can quote a sea shipment, and that is a Sea nomination. The seat is only a fallback.
 */
export function nrsBookingMode(quoteMode: string | undefined | null, seat: string | undefined | null): "air" | "sea" {
  if (quoteMode === "sea") return "sea";
  if (quoteMode === "air") return "air";
  return seat === "sea-nom" ? "sea" : "air";
}

/** Who sees the Won switch on a row: a quote made on a nomination desk, to the people at that desk and to the admin. */
export function canQuickWon(
  row: Pick<EnquiryRecord, "status" | "deskSeat" | "creator">,
  username: string | undefined | null,
  admin: boolean,
): boolean {
  if (row.status !== "quoted" && row.status !== "open" && row.status !== "won") return false;
  const seat = quoteDeskSeatId(row);
  if (!seat || !NOMINATION_SEATS.includes(seat)) return false;
  return admin || belongsToViewersDesk(row, username);
}

export interface QuickWon {
  quoteId: string;
  ref: string;
  customer: string;
  /** What the quote was before, so Undo puts it back exactly. */
  prevStatus: string;
  prevDate: string;
}

export async function quickWon(row: EnquiryRecord, username: string): Promise<QuickWon> {
  const full = await fetchQuoteById(row.id);
  const ref = full ? getQuoteRefId(full) : row.ref;
  const buy = Number(full?.buyRate ?? full?.confirmedBuyRate ?? row.buyRate ?? row.buyTotal ?? 0);
  const sell = Number(full?.amount ?? row.grandTotal ?? 0);
  const prev: QuickWon = { quoteId: row.id, ref, customer: row.customer, prevStatus: String(full?.status ?? "quoted"), prevDate: String(full?.date ?? "") };

  await convertQuoteToWon(row.id, {});
  const commodity = String(full?.commodity ?? "");
  await upsertWonFollowUp(
    {
      quoteId: row.id,
      ref,
      customer: row.customer,
      wonAt: new Date().toISOString(),
      ownerSeat: quoteDeskSeatId(row) ?? "",
      ownerLogin: row.creator || username,
      shipperName: "",
      consigneeName: "",
      commodity,
      buyRate: buy,
      sellAmount: sell,
    },
    username,
  );

  const seat = quoteDeskSeatId(row);
  pushNrsFollowUp({ quoteId: row.id, ref, customer: row.customer, buyRate: buy, sellRate: sell, shipper: "", consignee: "", commodity });
  pushNrsAlert(`Priority confirmation needed for ${ref} · ${row.customer}${commodity ? ` · ${commodity}` : ""}`, ref);
  await saveNrsRegistryEntry(
    buildRegistryEntry({
      quoteId: row.id,
      ref,
      customer: row.customer,
      mode: nrsBookingMode(row.mode, seat),
      pol: row.origin,
      pod: row.destination,
      commodity,
      confirmedCarrier: row.carrier,
      confirmedBuyRate: buy,
      grossProfit: row.grossProfit,
      grossProfitINR: row.grossProfitINR,
      grossProfitCurrency: row.grossProfitCurrency,
      creator: row.creator,
      deskSeat: seat,
    }),
  ).catch((e) => console.warn("NRS directory save:", e instanceof Error ? e.message : e));
  return prev;
}

/**
 * Puts a quote back to how it was. `withdrawNrs` is true only for the immediate Undo: the NRS follow-up, alert and directory
 * entry are removed too, because nobody has worked on them yet. Switched off later, the NRS records stay, so no one loses notes.
 */
export async function undoQuickWon(w: QuickWon, opts: { withdrawNrs: boolean }): Promise<void> {
  await patchQuote(w.quoteId, { status: w.prevStatus, ...(w.prevDate ? { date: w.prevDate } : {}), conversionDate: "" });
  await deleteWonFollowUp(w.quoteId).catch(() => undefined);
  if (opts.withdrawNrs) {
    withdrawNrsHandover(w.quoteId, w.ref);
    await deleteNrsRegistryEntry(w.quoteId).catch(() => undefined);
  }
}

/** For a quote switched off later (no Undo window): only what the quote itself needs. */
export function quickWonFromRow(row: EnquiryRecord): QuickWon {
  return { quoteId: row.id, ref: row.ref, customer: row.customer, prevStatus: "quoted", prevDate: "" };
}
