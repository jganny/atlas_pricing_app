/**
 * IMAP automation config (pricing + pricingsales).
 *
 * Passwords must NEVER be committed. When you are ready, set these in the
 * hosting environment / Firebase Functions secrets and redeploy the mail poller:
 *
 *   ATLAS_IMAP_PRICING_USER=pricing@…
 *   ATLAS_IMAP_PRICING_PASS=********
 *   ATLAS_IMAP_PRICINGSALES_USER=pricingsales@…
 *   ATLAS_IMAP_PRICINGSALES_PASS=********
 *   ATLAS_IMAP_HOST=…
 *   ATLAS_IMAP_PORT=993
 *
 * The React app only shows connection status; polling stays server-side.
 */

export type ImapMailboxId = "pricing" | "pricingsales";

export type ImapMailboxStatus = {
  id: ImapMailboxId;
  label: string;
  userEnv: string;
  configured: boolean;
  note: string;
};

export function getImapMailboxStatus(): ImapMailboxStatus[] {
  const pricingUser = process.env.NEXT_PUBLIC_IMAP_PRICING_USER || "";
  const salesUser = process.env.NEXT_PUBLIC_IMAP_PRICINGSALES_USER || "";
  return [
    {
      id: "pricing",
      label: "pricing mailbox",
      userEnv: "NEXT_PUBLIC_IMAP_PRICING_USER",
      configured: Boolean(pricingUser),
      note: pricingUser
        ? `Visible as ${pricingUser} — password stays in server secrets`
        : "Share credentials when ready; we will wire Functions secrets (not the client).",
    },
    {
      id: "pricingsales",
      label: "pricingsales mailbox",
      userEnv: "NEXT_PUBLIC_IMAP_PRICINGSALES_USER",
      configured: Boolean(salesUser),
      note: salesUser
        ? `Visible as ${salesUser} — password stays in server secrets`
        : "Share credentials when ready; inbox automation will poll this mailbox.",
    },
  ];
}
