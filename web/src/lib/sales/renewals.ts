import type { Account, EnquiryRecord, SalesLead } from "@/lib/types";

export const RENEWAL_LOOKAHEAD_DAYS = 60;
export const STALE_ACCOUNT_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseTime(v?: string): number | null {
  if (!v) return null;
  const n = Number(v);
  const t = Number.isFinite(n) && n > 1e11 ? n : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

const norm = (s?: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

function latest(...times: Array<number | null>): number | null {
  const real = times.filter((t): t is number => t != null);
  return real.length ? Math.max(...real) : null;
}

export interface AccountActivity {
  lastWonAt: number | null;
  lastQuoteAt: number | null;
  /** Most recent of any quote or win. */
  lastActivityAt: number | null;
}

/**
 * Last quote/win per account. Quotes are matched to an account by exact
 * (case/space-insensitive) customer name — deliberately not fuzzy, so one
 * account never inherits another company's history. Leads count via accountId.
 */
export function accountActivity(account: Account, leads: SalesLead[], enquiries: EnquiryRecord[]): AccountActivity {
  const name = norm(account.name);
  let lastWon = parseTime(account.lastWonAt);
  let lastQuote = parseTime(account.lastQuoteAt);
  for (const e of enquiries) {
    if (norm(e.customer) !== name) continue;
    const t = parseTime(e.createdAt);
    if (t == null) continue;
    lastQuote = latest(lastQuote, t);
    if (e.status === "won") lastWon = latest(lastWon, t);
  }
  for (const l of leads) {
    if (l.accountId !== account.id || l.status !== "won") continue;
    lastWon = latest(lastWon, parseTime(l.wonAt) ?? parseTime(l.updatedAt));
  }
  return { lastWonAt: lastWon, lastQuoteAt: lastQuote, lastActivityAt: latest(lastWon, lastQuote) };
}

export type RenewalReason = "renewal-overdue" | "renewal-soon" | "gone-quiet";

export interface RenewalStatus {
  reason: "renewal-overdue" | "renewal-soon" | null;
  /** Negative = overdue by that many days. */
  daysUntil: number | null;
}

/** Contract renewal date within the look-ahead window, or already past. */
export function contractRenewalStatus(
  account: Pick<Account, "contractRenewalDate">,
  now: number,
  lookaheadDays = RENEWAL_LOOKAHEAD_DAYS,
): RenewalStatus {
  const t = parseTime(account.contractRenewalDate);
  if (t == null) return { reason: null, daysUntil: null };
  const daysUntil = Math.ceil((t - now) / DAY_MS);
  if (daysUntil < 0) return { reason: "renewal-overdue", daysUntil };
  if (daysUntil <= lookaheadDays) return { reason: "renewal-soon", daysUntil };
  return { reason: null, daysUntil };
}

/**
 * Active customers who've gone quiet — an upsell / re-engage prompt. Only
 * accountType "customer" is considered (prospects have no history to lose,
 * churned accounts are already lost). With no recorded activity, the account's
 * creation date is the clock, so a brand-new account isn't flagged on day one.
 */
export function isAccountQuiet(
  account: Account,
  activity: AccountActivity,
  now: number,
  staleDays = STALE_ACCOUNT_DAYS,
): { quiet: boolean; daysSilent: number | null } {
  if (account.accountType !== "customer") return { quiet: false, daysSilent: null };
  const ref = activity.lastActivityAt ?? parseTime(account.createdAt);
  if (ref == null) return { quiet: false, daysSilent: null };
  const daysSilent = Math.floor((now - ref) / DAY_MS);
  return { quiet: daysSilent > staleDays, daysSilent };
}

export interface AttentionItem {
  account: Account;
  reasons: RenewalReason[];
  renewalInDays: number | null;
  daysSilent: number | null;
  lastActivityAt: number | null;
  /** An open (not won/lost) lead already exists for this account. */
  hasOpenLead: boolean;
}

export function accountsNeedingAttention(
  accounts: Account[],
  leads: SalesLead[],
  enquiries: EnquiryRecord[],
  now: number = Date.now(),
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const account of accounts) {
    if (account.accountType === "churned") continue;
    const renewal = contractRenewalStatus(account, now);
    const activity = accountActivity(account, leads, enquiries);
    const quiet = isAccountQuiet(account, activity, now);
    const reasons: RenewalReason[] = [];
    if (renewal.reason) reasons.push(renewal.reason);
    if (quiet.quiet) reasons.push("gone-quiet");
    if (!reasons.length) continue;
    items.push({
      account,
      reasons,
      renewalInDays: renewal.daysUntil,
      daysSilent: quiet.daysSilent,
      lastActivityAt: activity.lastActivityAt,
      hasOpenLead: leads.some(
        (l) =>
          l.status !== "won" &&
          l.status !== "lost" &&
          (l.accountId === account.id || norm(l.company) === norm(account.name)),
      ),
    });
  }
  const rank = (i: AttentionItem) =>
    i.reasons.includes("renewal-overdue") ? 0 : i.reasons.includes("renewal-soon") ? 1 : 2;
  return items.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.renewalInDays ?? Infinity) - (b.renewalInDays ?? Infinity) ||
      (b.daysSilent ?? 0) - (a.daysSilent ?? 0),
  );
}
