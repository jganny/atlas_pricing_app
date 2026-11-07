/**
 * The search in the top bar: what to show for what was typed.
 * Pure, so the rules can be tested. The screen (components/GlobalSearch.tsx) only draws these rows and opens them.
 *
 * Groups, in this order: Quotes, Customers, Settings (administrators only), Go to (a page named in plain words), and a last
 * row "Start a quote from this" when the words read like a quote request ("quote air BLR to DXB 120 kg").
 */
import type { DeskIntent } from "@/lib/ai/desk-intent";
import type { AdminSectionDef } from "@/lib/admin/sections";
import { searchSections } from "@/lib/admin/sections";
import { enquiryHref } from "@/lib/quotes/find-quotes";
import type { EnquiryRecord } from "@/lib/types";

export type SearchKind = "quote" | "customer" | "setting" | "page" | "start";

export interface SearchRow {
  key: string;
  kind: SearchKind;
  title: string;
  sub: string;
  meta?: string;
  href: string;
}

export interface SearchGroup {
  label: string;
  items: SearchRow[];
}

export const LIMITS = { quotes: 5, customers: 3, settings: 3 } as const;

export function quoteRow(row: EnquiryRecord): SearchRow {
  const lane = row.origin || row.destination ? ` · ${row.origin || "?"}→${row.destination || "?"}` : "";
  return {
    key: `q-${row.id}`,
    kind: "quote",
    title: row.customer || row.ref,
    sub: `${row.ref}${lane}${row.carrier ? ` · ${row.carrier}` : ""}`,
    meta: row.status,
    href: enquiryHref(row),
  };
}

/** Customers whose name contains every word typed, busiest first. Names are compared without case or extra spaces. */
export function customerHits(rows: EnquiryRecord[], raw: string, limit: number = LIMITS.customers): Array<{ name: string; count: number }> {
  const words = raw.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  const counts = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    const name = (r.customer || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!words.every((w) => key.includes(w))) continue;
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else counts.set(key, { name, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

export function customerRow(c: { name: string; count: number }): SearchRow {
  return {
    key: `c-${c.name.toLowerCase()}`,
    kind: "customer",
    title: c.name,
    sub: `${c.count} quote${c.count === 1 ? "" : "s"}`,
    href: `/enquiries/?q=${encodeURIComponent(c.name)}`,
  };
}

export function settingRow(s: AdminSectionDef): SearchRow {
  return { key: `s-${s.id}`, kind: "setting", title: s.title, sub: `Admin · ${s.group}`, href: `/admin/?section=${s.id}` };
}

export interface BuildInput {
  /** What was typed. */
  query: string;
  intent: DeskIntent;
  /** Quotes already on screen that match, best first. */
  quotes: EnquiryRecord[];
  /** Older quotes found by looking further back; never repeats one in `quotes`. */
  older: EnquiryRecord[];
  /** Quotes the person asked to hide from search results. */
  hiddenIds: ReadonlySet<string>;
  /** Every quote on screen, to find customers. */
  allRows: EnquiryRecord[];
  /** Admin sections this person may open (empty for everyone else). */
  sections: AdminSectionDef[];
}

export function buildGroups(input: BuildInput): SearchGroup[] {
  const q = input.query.trim();
  if (q.length < 2) return [];
  const groups: SearchGroup[] = [];

  if (input.intent.kind === "find") {
    const seen = new Set<string>();
    const quoteItems: SearchRow[] = [];
    for (const r of [...input.quotes, ...input.older]) {
      if (seen.has(r.id) || input.hiddenIds.has(r.id)) continue;
      seen.add(r.id);
      quoteItems.push(quoteRow(r));
      if (quoteItems.length >= LIMITS.quotes) break;
    }
    if (quoteItems.length) groups.push({ label: "Quotes", items: quoteItems });

    const customers = customerHits(input.allRows, input.intent.query).map(customerRow);
    if (customers.length) groups.push({ label: "Customers", items: customers });
  }

  if (input.sections.length) {
    const settings = searchSections(q, input.sections).slice(0, LIMITS.settings).map(settingRow);
    if (settings.length) groups.push({ label: "Settings", items: settings });
  }

  if (input.intent.kind === "goto") {
    groups.push({ label: "Go to", items: [{ key: `g-${input.intent.href}`, kind: "page", title: input.intent.label, sub: "Opens that page", href: input.intent.href }] });
  }

  if (input.intent.kind === "new") {
    const lane = input.intent.origin && input.intent.dest ? ` ${input.intent.origin} to ${input.intent.dest}` : "";
    groups.push({
      label: "Quote",
      items: [{ key: "start", kind: "start", title: "Start a quote from this", sub: `${input.intent.mode[0].toUpperCase()}${input.intent.mode.slice(1)} desk${lane}`, href: `/${input.intent.mode}` }],
    });
  }
  return groups;
}

export function flatten(groups: SearchGroup[]): SearchRow[] {
  return groups.flatMap((g) => g.items);
}

/** Move the highlighted row, wrapping at both ends. */
export function moveActive(current: number, delta: number, total: number): number {
  if (total <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : total - 1;
  return (current + delta + total) % total;
}
