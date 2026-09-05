/**
 * IMAP mailbox status for the UI.
 *
 * Live polling is server-side (Firebase Functions `pollPricingInboxes`).
 * Slim AI/heuristic intake: classify → store enquiry ticket only (no full body).
 * Passwords live ONLY as Firebase secrets:
 *   IMAP_PRICING_PASSWORD
 *   IMAP_PRICINGSALES_PASSWORD
 * Optional AI:
 *   ANTHROPIC_API_KEY
 *
 * On your Mac:
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions:pollPricingInboxes --project vertex-35d95
 *
 * Never put mailbox passwords in NEXT_PUBLIC_* or commit them to git.
 */

import { MAILBOX_TEAMS } from "@/lib/quotes/team-roles";

export type ImapMailboxId = "pricing" | "pricingsales";

export type ImapMailboxStatus = {
  id: ImapMailboxId;
  label: string;
  email: string;
  secretName: string;
  /** Username is public; password presence is only known after Functions deploy. */
  note: string;
};

export function getImapMailboxStatus(): ImapMailboxStatus[] {
  return [
    {
      id: "pricing",
      label: "Pricing mailbox",
      email: MAILBOX_TEAMS.pricing.email,
      secretName: "IMAP_PRICING_PASSWORD",
      note: "Polled every 2 min → Air/Sea nomination desks (Shashank / Shaheer)",
    },
    {
      id: "pricingsales",
      label: "Pricing sales mailbox",
      email: MAILBOX_TEAMS.pricingsales.email,
      secretName: "IMAP_PRICINGSALES_PASSWORD",
      note: "Polled every 2 min → Free-hand / NRS desks (Kavya / Cathrina)",
    },
  ];
}
