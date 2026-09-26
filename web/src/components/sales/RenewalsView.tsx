"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAccounts, useEnquiries, useLeads } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { saveLead } from "@/lib/firebase/sales";
import { logAudit } from "@/lib/firebase/audit-log";
import {
  RENEWAL_LOOKAHEAD_DAYS,
  STALE_ACCOUNT_DAYS,
  accountsNeedingAttention,
  type AttentionItem,
} from "@/lib/sales/renewals";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";

function reasonBadges(item: AttentionItem) {
  return item.reasons.map((r) =>
    r === "renewal-overdue" ? (
      <Badge key={r} tone="error">
        Renewal overdue {Math.abs(item.renewalInDays ?? 0)}d
      </Badge>
    ) : r === "renewal-soon" ? (
      <Badge key={r} tone="warn">
        Renews in {item.renewalInDays}d
      </Badge>
    ) : (
      <Badge key={r} tone="info">
        Quiet {item.daysSilent}d
      </Badge>
    ),
  );
}

export function RenewalsView() {
  const user = useAuthStore((s) => s.user);
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: leads = [] } = useLeads();
  const { data: enquiries = [] } = useEnquiries();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  const items = useMemo(
    () => accountsNeedingAttention(accounts, leads, enquiries),
    [accounts, leads, enquiries],
  );
  const renewals = items.filter((i) => i.reasons.some((r) => r !== "gone-quiet")).length;
  const quiet = items.filter((i) => i.reasons.includes("gone-quiet")).length;

  async function createFollowUp(item: AttentionItem) {
    if (!user?.username) {
      toast("Sign in required", "error");
      return;
    }
    setBusyId(item.account.id);
    try {
      const renewal = item.reasons.some((r) => r !== "gone-quiet");
      const leadId = await saveLead({
        company: item.account.name,
        accountId: item.account.id,
        status: "new",
        mode: "air",
        source: "Existing customer",
        owner: user.username,
        nextAction: renewal ? "Renewal check-in — confirm rates / agreement" : "Re-engage — ask about upcoming shipments",
        nextDueDate: new Date().toISOString().slice(0, 10),
        territory: item.account.territory,
      });
      logAudit({ action: "lead.create", entityType: "lead", entityId: leadId, entityLabel: item.account.name, summary: `Follow-up lead from Renewals (${renewal ? "renewal check-in" : "re-engage"})` });
      setCreated((prev) => new Set(prev).add(item.account.id));
      toast(`Follow-up lead created for ${item.account.name}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create lead", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <Card>Loading accounts…</Card>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm" data-testid="renewals-kpi-strip">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Need attention</div>
          <div className="text-lg font-extrabold">{items.length}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Renewals due / overdue</div>
          <div className="text-lg font-extrabold text-amber-600">{renewals}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Gone quiet</div>
          <div className="text-lg font-extrabold text-sky-800">{quiet}</div>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Flags accounts whose contract renewal date is within {RENEWAL_LOOKAHEAD_DAYS} days (or past), and{" "}
        <strong>customer</strong> accounts with no quote or win for more than {STALE_ACCOUNT_DAYS} days — a prompt to
        renew or upsell. Quotes are matched to an account by exact customer name. Set the renewal date and account
        type on the Accounts tab.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Why</th>
              <th className="px-3 py-2">Last quote / win</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                  {accounts.length === 0
                    ? "No accounts yet — add customers on the Accounts tab."
                    : "Nothing needs attention right now."}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.account.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-semibold">{item.account.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">{reasonBadges(item)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {item.lastActivityAt ? new Date(item.lastActivityAt).toLocaleDateString() : "None on record"}
                  </td>
                  <td className="px-3 py-2">{TEAM_ROLES[item.account.owner]?.name || item.account.owner || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {item.hasOpenLead || created.has(item.account.id) ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        {created.has(item.account.id) ? "Lead created" : "Open lead exists"}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === item.account.id}
                        onClick={() => void createFollowUp(item)}
                      >
                        Create follow-up lead
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
