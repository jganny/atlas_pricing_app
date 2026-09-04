"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Clock,
  Inbox,
  MessageSquare,
  PlaneTakeoff,
  Ship,
  StickyNote,
  Users,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { LogisticsNewsFeed } from "@/components/LogisticsNewsFeed";
import { PerformanceReportPanel } from "@/components/PerformanceReportPanel";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useEnquiries, useLeads } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { canAccessRoute, deskFocusLabel } from "@/lib/auth/rbac";
import { useLiveData } from "@/lib/api";
import {
  fetchAmendmentRequests,
  resolveAmendment,
  type AmendmentRequest,
} from "@/lib/firebase/amendments";
import { listOfflineQuotes, removeOfflineQuote } from "@/lib/quotes/offline-cache";
import { dismissNrsAlert, listNrsAlerts, type NrsAlert } from "@/lib/quotes/nrs-alerts";
import { listSmsOutbox, sendSms } from "@/lib/sms/gateway";
import { isAdminUser, TEAM_ROLES, deskDisplayName } from "@/lib/quotes/team-roles";
import { formatCurrency } from "@/lib/utils";

const STICKY_KEY = "atlas_desk_sticky_notes";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: enquiries = [], isLoading, error } = useEnquiries();
  const { data: leads = [] } = useLeads();
  const focus = deskFocusLabel(user?.username);
  const admin = isAdminUser(user?.username, user?.role);
  const username = (user?.username || "").toLowerCase();

  const [amendments, setAmendments] = useState<AmendmentRequest[]>([]);
  const [sticky, setSticky] = useState("");
  const [offline, setOffline] = useState(listOfflineQuotes());
  const [smsTo, setSmsTo] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [smsLog, setSmsLog] = useState(listSmsOutbox());
  const [nrsAlerts, setNrsAlerts] = useState<NrsAlert[]>([]);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(STICKY_KEY) || "{}") as Record<
        string,
        string
      >;
      setSticky(all[username] || "");
      setSmsLog(listSmsOutbox());
      setNrsAlerts(listNrsAlerts().filter((a) => !a.dismissed));
    } catch {
      setSticky("");
    }
  }, [username]);

  useEffect(() => {
    if (!admin) return;
    void fetchAmendmentRequests().then(setAmendments);
  }, [admin]);

  const mine = useMemo(
    () =>
      enquiries.filter(
        (e) =>
          e.creator?.toLowerCase() === username ||
          e.assignee?.toLowerCase().includes(focus.toLowerCase().slice(0, 4)),
      ),
    [enquiries, username, focus],
  );

  const scope = admin ? enquiries : mine;
  const open = scope.filter((e) => e.status === "open" || e.status === "quoted").length;
  const won = scope.filter((e) => e.status === "won").length;
  const overdue = scope.filter((e) => e.slaHoursOpen > 8).length;
  const dueSoon = scope.filter((e) => e.slaHoursOpen > 4 && e.slaHoursOpen <= 8).length;
  const revenue = scope
    .filter((e) => e.status === "won")
    .reduce((s, e) => s + (e.amountINR || e.grandTotal || 0), 0);
  const conversion =
    scope.length > 0 ? Math.round((won / Math.max(1, scope.length)) * 100) : 0;

  const byDesk = useMemo(() => {
    const m: Record<string, number> = {};
    enquiries.forEach((e) => {
      const k = e.creator || "unknown";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [enquiries]);

  const pendingAmd = amendments.filter((a) => a.status === "pending");
  const salesPipeline = leads
    .filter((l) => l.status !== "won" && l.status !== "lost")
    .reduce((s, l) => s + (l.dealValue || 0), 0);
  const enquiryPipeline = scope
    .filter((e) => e.status === "open" || e.status === "quoted")
    .reduce((s, e) => s + (e.amountINR || e.grandTotal || 0), 0);
  const pipeline = salesPipeline > 0 ? salesPipeline : enquiryPipeline;
  const pipelineLabel = salesPipeline > 0 ? "Sales pipeline" : "Open quote pipeline";

  const showAir = canAccessRoute(user?.username, user?.role, "air");
  const showSea = canAccessRoute(user?.username, user?.role, "sea");
  const showInbox = canAccessRoute(user?.username, user?.role, "inbox");
  const showParity = canAccessRoute(user?.username, user?.role, "feature-parity");

  const nrsEntries = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("atlas_nrs_registry") || "[]") as Array<{
        shipper: string;
        consignee: string;
        quoteRef?: string;
      }>;
    } catch {
      return [];
    }
  }, []);

  function saveSticky() {
    try {
      const all = JSON.parse(localStorage.getItem(STICKY_KEY) || "{}") as Record<
        string,
        string
      >;
      all[username || "desk"] = sticky;
      localStorage.setItem(STICKY_KEY, JSON.stringify(all));
      toast("Sticky note saved", "success");
    } catch {
      toast("Could not save note", "error");
    }
  }

  function queueSms() {
    if (!smsTo.trim() || !smsBody.trim()) {
      toast("Phone and message required", "error");
      return;
    }
    void (async () => {
      try {
        const entry = await sendSms({
          to: smsTo.trim(),
          body: smsBody.trim(),
          by: username,
        });
        setSmsLog(listSmsOutbox());
        setSmsBody("");
        toast(
          entry.via === "device"
            ? "Opened device SMS app"
            : entry.via === "webhook"
              ? "Sent via webhook"
              : "SMS queued locally",
          "success",
        );
      } catch {
        toast("Could not send SMS", "error");
      }
    })();
  }

  async function onResolve(id: string, status: "approved" | "rejected") {
    await resolveAmendment(id, status, username || "admin");
    setAmendments(await fetchAmendmentRequests());
    toast(status === "approved" ? "Amendment approved (2h unlock)" : "Amendment rejected", "success");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
          {admin ? "Manager overview" : "My desk"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {focus} ·{" "}
          {useLiveData
            ? "Live enquiries — updates automatically. Press ⌘K to jump."
            : "Mock data — mirrors Enquiry DB SLA."}
        </p>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50 py-3">
          <p className="text-sm font-semibold text-red-800">
            Could not load enquiries. Sign in with your Atlas desk credentials.
          </p>
        </Card>
      ) : null}

      {showParity ? (
        <Card className="border-emerald-200 bg-emerald-50/60 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-800">
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-sm font-bold">Legacy parity complete — ready for your cutover test</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                120/120 tracker items shipped. Walk Feature parity, then approve cutover when React feels equal or better.
              </p>
            </div>
            <Link
              href="/feature-parity"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14154a]"
            >
              Trackers
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Hub cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/enquiries", label: "Enquiry DB", blurb: "Lifecycle & CSV" },
          { href: "/analytics", label: "Analytics", blurb: "Pipeline & desks" },
          { href: "/directory", label: "Directory", blurb: "Agents & vendors" },
          { href: "/sales", label: "Sales", blurb: "Kanban leads" },
        ].map((h) => (
          <Link key={h.href} href={h.href}>
            <Card className="py-3 transition hover:border-sky-300">
              <div className="font-bold text-[var(--color-atlas-navy)]">{h.label}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{h.blurb}</div>
            </Card>
          </Link>
        ))}
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Open
              </div>
              <div className="mt-2 text-3xl font-extrabold text-[var(--color-atlas-navy)]">
                {open}
              </div>
            </Card>
            <Card className="py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Won
              </div>
              <div className="mt-2 text-3xl font-extrabold text-emerald-700">{won}</div>
            </Card>
            <Card className="py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Conversion
              </div>
              <div className="mt-2 text-3xl font-extrabold text-[var(--color-atlas-navy)]">
                {conversion}%
              </div>
            </Card>
            <Card className="py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                Due soon
              </div>
              <div className="mt-2 text-3xl font-extrabold text-amber-600">{dueSoon}</div>
            </Card>
            <Card className="py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue
              </div>
              <div className="mt-2 text-3xl font-extrabold text-red-600">{overdue}</div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="py-3">
              <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                {admin ? "Won revenue" : "My won revenue"}
              </div>
              <div className="mt-1 text-xl font-extrabold">
                {formatCurrency(revenue, "INR")}
              </div>
              {admin ? (
                <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {pipelineLabel} {formatCurrency(pipeline, "INR")}
                </div>
              ) : null}
            </Card>
            <Card className="py-3 lg:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4" />
                {admin ? "Quoting agents" : "Quick desks"}
              </div>
              {admin ? (
                <ul className="grid gap-1 sm:grid-cols-2 text-sm">
                  {byDesk.map(([id, n]) => (
                    <li
                      key={id}
                      className="flex justify-between rounded-md bg-slate-50 px-2 py-1.5"
                    >
                      <span>{deskDisplayName(id)}</span>
                      <span className="font-bold">{n}</span>
                    </li>
                  ))}
                  {byDesk.length === 0
                    ? Object.keys(TEAM_ROLES)
                        .filter((k) => TEAM_ROLES[k].type === "member")
                        .slice(0, 6)
                        .map((k) => (
                          <li key={k} className="rounded-md bg-slate-50 px-2 py-1.5">
                            {TEAM_ROLES[k].name}
                          </li>
                        ))
                    : null}
                </ul>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {showAir ? (
                    <Link href="/air" className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                      <PlaneTakeoff className="mr-1 inline h-4 w-4" /> Air
                    </Link>
                  ) : null}
                  {showSea ? (
                    <Link href="/sea" className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                      <Ship className="mr-1 inline h-4 w-4" /> Sea
                    </Link>
                  ) : null}
                  {showInbox ? (
                    <Link href="/inbox" className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
                      <Inbox className="mr-1 inline h-4 w-4" /> Inbox
                    </Link>
                  ) : null}
                </div>
              )}
            </Card>
          </div>

          {!admin ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <div className="mb-2 flex items-center gap-2 font-bold">
                  <StickyNote className="h-4 w-4" />
                  Desk sticky note
                </div>
                <Textarea
                  rows={4}
                  value={sticky}
                  onChange={(e) => setSticky(e.target.value)}
                  placeholder="Reminders for this desk…"
                />
                <Button type="button" className="mt-2" onClick={saveSticky}>
                  Save note
                </Button>
              </Card>
              <Card>
                <h2 className="mb-2 font-bold">My recent quotes</h2>
                <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                  {mine.slice(0, 12).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/enquiries/?q=${encodeURIComponent(e.ref)}&select=${e.id}`}
                        className="flex justify-between rounded-md px-2 py-1 hover:bg-slate-50"
                      >
                        <span className="font-semibold text-sky-800">{e.ref}</span>
                        <span className="text-[var(--color-text-muted)]">{e.customer}</span>
                      </Link>
                    </li>
                  ))}
                  {mine.length === 0 ? (
                    <li className="text-[var(--color-text-muted)]">No quotes for this desk yet.</li>
                  ) : null}
                </ul>
                {nrsEntries.length > 0 ? (
                  <div className="mt-3 border-t pt-2">
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                      NRS registry (local)
                    </div>
                    <ul className="mt-1 text-xs">
                      {nrsEntries.slice(0, 5).map((n, i) => (
                        <li key={i}>
                          {n.shipper} → {n.consignee}
                          {n.quoteRef ? ` · ${n.quoteRef}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
              <Card>
                <div className="mb-2 flex items-center gap-2 font-bold">
                  <MessageSquare className="h-4 w-4" />
                  Instant SMS (outbox)
                </div>
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                  Queues messages locally until an SMS gateway API key is configured.
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Mobile number"
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Message"
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                  />
                  <Button type="button" onClick={queueSms}>
                    Queue SMS
                  </Button>
                </div>
                {smsLog.length > 0 ? (
                  <ul className="mt-3 max-h-28 space-y-1 overflow-auto text-xs text-[var(--color-text-muted)]">
                    {smsLog.slice(0, 5).map((s, i) => (
                      <li key={`${s.at}-${i}`}>
                        {s.to}: {s.body.slice(0, 60)}
                        {s.body.length > 60 ? "…" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </div>
          ) : null}

          {admin ? (
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">Pending amendment approvals</h2>
                <Badge tone={pendingAmd.length ? "warn" : "neutral"}>{pendingAmd.length}</Badge>
              </div>
              {pendingAmd.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No pending requests.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pendingAmd.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold">
                          {a.quoteRef || a.quoteId} · {a.customer || "—"}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          by {a.requestedBy}
                          {a.reason ? ` — ${a.reason}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="px-3 py-1 text-xs"
                          onClick={() => void onResolve(a.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-1 text-xs"
                          onClick={() => void onResolve(a.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {!admin && nrsAlerts.length > 0 ? (
            <Card className="border-amber-200 bg-amber-50/50">
              <h2 className="mb-2 font-bold text-amber-950">NRS confirmation alerts</h2>
              <ul className="space-y-2 text-sm">
                {nrsAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-2 rounded-md bg-white/80 px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold">{a.message}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {new Date(a.date).toLocaleString()}
                        {a.quoteRef ? ` · ${a.quoteRef}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        dismissNrsAlert(a.id);
                        setNrsAlerts(listNrsAlerts().filter((x) => !x.dismissed));
                      }}
                    >
                      Dismiss
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {admin ? <PerformanceReportPanel rows={enquiries} /> : null}

          <LogisticsNewsFeed />

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Offline quote backups</h2>
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => setOffline(listOfflineQuotes())}
              >
                Refresh
              </Button>
            </div>
            {offline.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                Saves from desks are cached here if the network drops.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {offline.slice(0, 10).map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5"
                  >
                    <span>
                      <Badge tone="neutral">{o.type}</Badge>{" "}
                      <span className="font-semibold">{o.customer || o.id}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                        {new Date(o.savedAt).toLocaleString()}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs text-rose-700"
                      onClick={() => {
                        removeOfflineQuote(o.id);
                        setOffline(listOfflineQuotes());
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
