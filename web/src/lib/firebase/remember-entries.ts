"use client";

import { rememberCustomEntry } from "@/lib/custom-entries";
import { searchCarriers } from "@/lib/carriers/directory";
import { HSN_COMMODITIES } from "@/lib/pricing/hsn";

/**
 * After a quote is saved: any customer, carrier or commodity it used that the
 * built-in lists don't know is remembered, so it shows up in the dropdowns next
 * time — for everyone. Never lets this housekeeping break a save.
 */
export async function rememberFromQuote(input: {
  kind: "air" | "sea";
  customer?: string;
  commodity?: string;
  carriers?: string[];
}): Promise<void> {
  try {
    if (input.customer && !/^draft$/i.test(input.customer.trim())) rememberCustomEntry("customers", input.customer);

    const commodity = input.commodity?.trim();
    if (commodity && !HSN_COMMODITIES.some((i) => i.name.toLowerCase() === commodity.toLowerCase() || i.label.toLowerCase() === commodity.toLowerCase())) {
      rememberCustomEntry(input.kind === "air" ? "air_commodities" : "sea_commodities", commodity);
    }

    for (const name of input.carriers ?? []) {
      const n = name?.trim();
      if (!n) continue;
      const hits = await searchCarriers(n, input.kind === "air" ? "airline" : "ocean", 3);
      const known = hits.some((h) => h.name.toLowerCase() === n.toLowerCase() || h.code.toLowerCase() === n.toLowerCase());
      if (!known) rememberCustomEntry(input.kind === "air" ? "airlines" : "linernames", n);
    }
  } catch (e) {
    console.warn("Remember entries:", e instanceof Error ? e.message : e);
  }
}
