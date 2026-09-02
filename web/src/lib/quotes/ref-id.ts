import type { SavedQuote } from "@/lib/types";

/** Mirrors legacy getQuoteRefId — AE/AI/SE/SI/TR/WH/CR + customer + date + seq */
export function getQuoteRefId(quote: Pick<SavedQuote, "type" | "customer" | "date" | "quoteNumber" | "details">): string {
  const type = quote.type || "air";
  const module = (quote.details?.module as string) || "export";

  let moduleCode = "XX";
  if (type === "air") moduleCode = module === "import" ? "AI" : "AE";
  else if (type === "transport") moduleCode = "TR";
  else if (type === "warehouse") moduleCode = "WH";
  else if (type === "courier") moduleCode = "CR";
  else moduleCode = module === "import" ? "SI" : "SE";

  const custPart = (quote.customer || "XYZ")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  let datePart = "0000";
  if (quote.date) {
    const parts = quote.date.split("-");
    if (parts.length === 3) {
      datePart = parts[1] + parts[0].substring(2);
    } else {
      const qDate = new Date(quote.date);
      if (!Number.isNaN(qDate.getTime())) {
        datePart =
          String(qDate.getMonth() + 1).padStart(2, "0") + String(qDate.getFullYear()).substring(2);
      }
    }
  }

  const seqPart = String(quote.quoteNumber ?? 1).padStart(5, "0");
  return `${moduleCode}${custPart}${datePart}IN${seqPart}`;
}

export function nextQuoteNumber(): number {
  return Math.floor(Date.now() / 1000) % 100000;
}
