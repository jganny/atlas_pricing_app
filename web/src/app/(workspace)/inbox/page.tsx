"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Loader2, Plane, Ship } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useInbox } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import { patchInboxEnquiry } from "@/lib/firebase/inbox";
import { canSeeInboxItem, parsedFromInbox } from "@/lib/mail/inbox-assign";
import { ATLAS_IMAP, MAILBOX_TEAMS, deskDisplayName } from "@/lib/quotes/team-roles";
import { storeSmartQuotePrefill } from "@/lib/pricing/smart-quote-prefill";
import type { InboxEnquiry } from "@/lib/types";

export default function EnquiryInboxPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: rows = [], isLoading } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => rows.filter((r) => canSeeInboxItem(user?.username, user?.role, r)),
    [rows, user?.username, user?.role],
  );
  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null;
  const unread = visible.filter((r) => r.status === "new").length;

  async function applyToDesk(item: InboxEnquiry) {
    const mode = item.mode === "sea" ? "sea" : "air";
    const parsed = parsedFromInbox(item);
    storeSmartQuotePrefill({
      mode,
      parsed: { ...parsed, source: "email-imap" },
      carrierLabel: parsed.airlineLabel || parsed.linerLabel || "From enquiry email",
      tariffFound: false,
      createdAt: Date.now(),
    });
    if (useLiveData) {
      setBusy(true);
      try {
        await patchInboxEnquiry(item.id, { status: "applied", claimedBy: user?.username ?? null });
      } catch {
        /* mock / rules */
      } finally {
        setBusy(false);
      }
    }
    toast("Opening desk with parsed fields — add Circulars rates there", "success");
    router.push(mode === "sea" ? "/sea/?smart=1" : "/air/?smart=1");
  }

  async function claim(item: InboxEnquiry) {
    if (!user?.username) return;
    if (useLiveData) {
      setBusy(true);
      try {
        await patchInboxEnquiry(item.id, { status: "claimed", claimedBy: user.username });
        toast("Claimed — this enquiry is yours", "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Claim failed", "error");
      } finally {
        setBusy(false);
      }
    } else {
      toast("Mock mode — claim is live-only", "info");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Inbox className="h-5 w-5 text-[var(--color-atlas-sky)]" />
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Enquiry inbox</h1>
          <Badge tone="info">AI + IMAP</Badge>
          {unread ? <Badge tone="warn">{unread} new</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Polls {ATLAS_IMAP.host}:{ATLAS_IMAP.port} · {MAILBOX_TEAMS.pricing.email} (Air Nom + Sea Nom) and{" "}
          {MAILBOX_TEAMS.pricingsales.email} (Free Hand Kavya + NRS Cathrina). You monitor copies on{" "}
          {MAILBOX_TEAMS.monitor.email}. Rates are still entered on the desk after Apply.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden p-0 lg:col-span-1">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading inbox…</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">
              No enquiries yet. After IMAP passwords are stored as Firebase secrets, new mail appears here.
            </p>
          ) : (
            <ul>
              {visible.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full border-b border-[var(--color-border)] px-4 py-3 text-left hover:bg-slate-50 ${
                      selected?.id === row.id ? "bg-sky-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {row.mode === "sea" ? (
                        <Ship className="h-3.5 w-3.5 text-sky-700" />
                      ) : (
                        <Plane className="h-3.5 w-3.5 text-violet-700" />
                      )}
                      <span className="truncate text-sm font-bold">{row.subject}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {row.mailboxEmail} · {row.status}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          {!selected ? (
            <p className="text-sm text-[var(--color-text-muted)]">Select an enquiry.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone={selected.mode === "unknown" ? "warn" : "info"}>{selected.mode}</Badge>
                <Badge tone="neutral">{selected.confidence}% parse</Badge>
                <Badge tone="neutral">{selected.mailbox}</Badge>
              </div>
              <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">{selected.subject}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                From {selected.from} · suggested{" "}
                {selected.suggestedUser ? deskDisplayName(selected.suggestedUser) : "shared mailbox"}
              </p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Customer</dt>
                  <dd className="font-semibold">{selected.parsed.customer || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Lane</dt>
                  <dd className="font-semibold">
                    {selected.parsed.origin || "—"} → {selected.parsed.destination || "—"}
                  </dd>
                </div>
              </dl>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap">
                {selected.body}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void applyToDesk(selected)}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply to {selected.mode === "sea" ? "Sea" : "Air"} desk
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void claim(selected)}>
                  Claim for me
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
