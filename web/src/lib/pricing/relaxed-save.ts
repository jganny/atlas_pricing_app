/**
 * Import quotes on delivered terms (DDP / DAP / DDU) are built from whichever
 * charge groups the desk ticks, so the carrier details (routing, transit time,
 * validity) and freight rates must not be compulsory just to save them.
 * Everything else — customer, lane, cargo, carrier name — is still checked.
 */
const RELAXED_TERMS = new Set(["DDP", "DAP", "DDU"]);

export function isRelaxedImportQuote(module: "export" | "import", incoterm: string): boolean {
  return module === "import" && RELAXED_TERMS.has((incoterm || "").trim().toUpperCase());
}
