/**
 * Real staff display names — split into their own file so the demo build
 * (scripts/build-demo.sh) can swap this exact file out for a demo-safe stub
 * before compiling, guaranteeing these strings never enter that build's
 * output at all. A runtime IS_DEMO_BUILD check isn't enough on its own —
 * Turbopack does not reliably dead-code-eliminate the unused branch of a
 * build-time-constant ternary, so the real names stayed in the demo bundle
 * even though nothing ever rendered them. Never import this file from
 * anywhere except team-roles.ts.
 */
export const REAL_NAMES: Record<string, string> = {
  ganny: "Pricing Team",
  shashank: "Air Nom",
  shaheer: "Sea Nomination",
  /** Current Free Hand desk holder. */
  kavya: "Free Hand",
  /** Historical creator id — old quotes still resolve to Free Hand. */
  jaya: "Free Hand",
  cathrina: "NRS",
  manager: "Manager",
  pricing: "Pricing Agent",
  // Individual Free Hand desk users — same category as kavya's seat, but each
  // is their own login with their own name and quote history, not a shared
  // seat. Hardcoded here for now, same as the rest of this map; a new Free
  // Hand starter still needs an entry added here to show their real name.
  sunil: "Sunil Kumar",
  ramesh: "M Ramesh",
  goutham: "Goutham",
  spoorthi: "Spoorthi N S",
  linson: "Linson Ittyera",
};

/** Real company mailbox addresses + IMAP host — same reason as above: the
 * demo build swaps this file for an empty stub so none of it ships there. */
export const REAL_MAILBOX_EMAILS = {
  pricing: "pricing@atlaslogistics.co.in",
  pricingsales: "pricingsales@atlaslogistics.co.in",
  monitor: "ganesh@blr.atlaslogistics.co.in",
};
export const REAL_IMAP_HOST = "czipop.logix.in";
