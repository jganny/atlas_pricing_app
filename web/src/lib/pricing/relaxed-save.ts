/**
 * Import quotes on delivered terms (DDP / DAP / DDU) are built from whichever
 * charge groups the desk ticks, so the carrier details (routing, transit time,
 * validity) and freight rates must not be compulsory just to save them.
 * Only the customer name is still required — origin, destination, cargo,
 * carrier and its details can all be left blank.
 */
const RELAXED_TERMS = new Set(["DDP", "DAP", "DDU"]);

export function isRelaxedImportQuote(module: "export" | "import", incoterm: string): boolean {
  return module === "import" && RELAXED_TERMS.has((incoterm || "").trim().toUpperCase());
}
