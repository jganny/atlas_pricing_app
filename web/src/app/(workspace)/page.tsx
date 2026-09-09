"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Inbox,
  PlaneTakeoff,
  Ship,
  Users,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { PerformanceReportPanel } from "@/components/PerformanceReportPanel";
import { VertexAskBar } from "@/components/VertexAskBar";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useEnquiries, useLeads } from "@/hooks/use-atlas-data";
import { useAuthStore } from "@/store/auth";
import { canAccessRoute, deskFocusLabel } from "@/lib/auth/rbac";
import {
  fetchAmendmentRequests,
  resolveAmendment,
  type AmendmentRequest,
} from "@/lib/firebase/amendments";
import { SwipeDeleteRow } from "@/components/SwipeDeleteRow";
import { deskEditHref } from "@/lib/quotes/find-quotes";
import {
  hideQuoteFromAsk,
  listHiddenQuoteIds,
  subscribeHiddenAsk,
} from "@/lib/quotes/hidden-ask";
import { listOfflineQuotes, removeOfflineQuote } from "@/lib/quotes/offline-cache";
import { dismissNrsAlert, listNrsAlerts, type NrsAlert } from "@/lib/quotes/nrs-alerts";
import { isAdminUser, TEAM_ROLES, deskDisplayName } from "@/lib/quotes/team-roles";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: enquiries = [], isLoading, error, refetch } = useEnquiries();
  const { data: leads = [] } = useLeads();
  const focus = deskFocusLabel(user?.username);
  const admin = isAdminUser(user?.username, user?.role);
  const username = (user?.username || "").toLowerCase();

  const [amendments, setAmendments] = useState<AmendmentRequest[]>([]);
  const [offline, setOffline] = useState(listOfflineQuotes());
  const [nrsAlerts, setNrsAlerts] = useState<NrsAlert[]>([]);
  const [hiddenAskIds, setHiddenAskIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      setNrsAlerts(listNrsAlerts().filter((a) => !a.dismissed));
    } catch {
      /* ignore */
    }
  }, [username]);

  useEffect(() => {
    const refresh = () => setHiddenAskIds(listHiddenQuoteIds());
    refresh();
    return subscribeHiddenAsk(refresh);
  }, []);

  useEffect(() => {
    if (!admin) return;
    void fetchAmendmentRequests().then(setAmendments);
  }, [admin]);

  useEffect(() => {
    function onRefresh() {
      void refetch();
      setOffline(listOfflineQuotes());
      setNrsAlerts(listNrsAlerts().filter((a) => !a.dismissed));
      if (admin) void fetchAmendmentRequests().then(setAmendments);
    }
    window.addEventListener("atlas:refresh", onRefresh);
    return () => window.removeEventListener("atlas:refresh", onRefresh);
  }, [admin, refetch]);

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
      .slice(0, 16);
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
  const showAnalytics = canAccessRoute(user?.username, user?.role, "analytics");
  const showDirectory = canAccessRoute(user?.username, user?.role, "directory");
  const showSales = canAccessRoute(user?.username, user?.role, "sales");
  const showEnquiries = canAccessRoute(user?.username, user?.role, "enquiries");

  const hubLinks = [
    showEnquiries
      ? { href: "/enquiries", label: "Enquiry DB", blurb: "Lifecycle & CSV" }
      : null,
    showAnalytics
      ? { href: "/analytics", label: "Analytics", blurb: "Pipeline & desks" }
      : null,
    showDirectory
      ? { href: "/directory", label: "Directory", blurb: "Agents & vendors" }
      : null,
    showSales ? { href: "/sales", label: "Sales", blurb: "Kanban leads" } : null,
    showInbox ? { href: "/inbox", label: "Inbox", blurb: "Email enquiries" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string; blurb: string }>;

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

  const queueItems = useMemo(() => {
    const hidden = new Set(hiddenAskIds);
    return [...scope]
      .filter((e) => !hidden.has(e.id))
      .sort((a, b) => (b.slaHoursOpen || 0) - (a.slaHoursOpen || 0))
      .slice(0, 10);
  }, [scope, hiddenAskIds]);

  async function onResolve(id: string, status: "approved" | "rejected") {
    await resolveAmendment(id, status, username || "admin");
    setAmendments(await fetchAmendmentRequests());
    toast(status === "approved" ? "Amendment approved (2h unlock)" : "Amendment rejected", "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Atlas workbench
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-atlas-navy)]">
            {admin ? "Manager overview" : "My desk"}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {focus} · Ask Vertex for a customer or city — you do not need the file name.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showAir ? (
            <Link
              href="/air"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-atlas-navy)] hover:border-sky-300"
            >
              <PlaneTakeoff className="h-3.5 w-3.5" /> Air desk
            </Link>
          ) : null}
          {showSea ? (
            <Link
              href="/sea"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-atlas-navy)] hover:border-sky-300"
            >
              <Ship className="h-3.5 w-3.5" /> Sea desk
            </Link>
          ) : null}
          {showInbox ? (
            <Link
              href="/inbox"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-atlas-navy)] px-3 py-2 text-xs font-bold text-white hover:bg-[#14154a]"
            >
              <Inbox className="h-3.5 w-3.5" /> Inbox
            </Link>
          ) : null}
        </div>
      </div>

      <VertexAskBar />

      {error ? (
        <Card className="border-red-200 bg-red-50 py-3">
          <p className="text-sm font-semibold text-red-800">
            Could not load enquiries. Sign in with your Atlas desk credentials.
          </p>
        </Card>
      ) : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="atlas-metric-strip">
            <div className="atlas-metric-cell">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Open
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                {open}
              </div>
            </div>
            <div className="atlas-metric-cell">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Won
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">{won}</div>
            </div>
            <div className="atlas-metric-cell">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Conversion
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">
                {conversion}%
              </div>
            </div>
            <div className="atlas-metric-cell">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                <Clock className="h-3 w-3" /> Due soon
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-amber-600">{dueSoon}</div>
            </div>
            <div className="atlas-metric-cell">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-red-600">{overdue}</div>
            </div>
          </div>

          <div className="atlas-workbench">
            <div className="space-y-4">
              <section className="atlas-panel overflow-hidden rounded-xl">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                      Work queue
                    </h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Highest SLA pressure first · {formatCurrency(revenue, "INR")} won
                      {admin ? ` · ${pipelineLabel} ${formatCurrency(pipeline, "INR")}` : ""}
                    </p>
                  </div>
                  {showEnquiries ? (
                    <Link
                      href="/enquiries"
                      className="text-xs font-bold text-sky-800 hover:underline"
                    >
                      Open EDB →
                    </Link>
                  ) : null}
                </div>
                <ul className="divide-y divide-[var(--color-border)]">
                  {queueItems.map((e) => (
                    <li key={e.id}>
                      <SwipeDeleteRow
                        deleteLabel="Delete"
                        onDelete={() => hideQuoteFromAsk(e.id)}
                      >
                        <Link
                          href={`/enquiries/?q=${encodeURIComponent(e.ref)}&select=${e.id}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 pr-16 hover:bg-sky-50/50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--color-atlas-navy)]">
                              {e.ref} · {e.customer || "—"}
                            </div>
                            <div className="truncate text-xs text-[var(--color-text-muted)]">
                              {e.status} · {e.mode || "—"} · {e.assignee || "unassigned"}
                            </div>
                          </div>
                          <Badge
                            tone={
                              e.slaHoursOpen > 8
                                ? "error"
                                : e.slaHoursOpen > 4
                                  ? "warn"
                                  : "neutral"
                            }
                          >
                            {Math.round(e.slaHoursOpen)}h
                          </Badge>
                        </Link>
                      </SwipeDeleteRow>
                    </li>
                  ))}
                  {queueItems.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                      Queue is clear for this desk.
                    </li>
                  ) : null}
                </ul>
              </section>

              {admin && pendingAmd.length > 0 ? (
                <section className="atlas-panel rounded-xl p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-extrabold">Pending amendment approvals</h2>
                    <Badge tone="warn">{pendingAmd.length}</Badge>
                  </div>
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
                            size="sm"
                            onClick={() => void onResolve(a.id, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void onResolve(a.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!admin && nrsAlerts.length > 0 ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <h2 className="mb-2 text-sm font-extrabold text-amber-950">
                    NRS confirmation alerts
                  </h2>
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
                          size="sm"
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
                </section>
              ) : null}

              {admin ? (
                <details className="atlas-panel rounded-xl px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-[var(--color-atlas-navy)]">
                    Desk performance
                  </summary>
                  <div className="mt-3">
                    <PerformanceReportPanel rows={enquiries} />
                  </div>
                </details>
              ) : null}
            </div>

            <aside className="space-y-3">
              {hubLinks.length > 0 ? (
                <nav className="atlas-panel overflow-hidden rounded-xl">
                  <div className="border-b border-[var(--color-border)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Quick links
                  </div>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {hubLinks.map((h) => (
                      <li key={h.href}>
                        <Link
                          href={h.href}
                          className="flex items-center justify-between px-3 py-2.5 hover:bg-sky-50/60"
                        >
                          <div>
                            <div className="text-sm font-bold text-[var(--color-atlas-navy)]">
                              {h.label}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)]">
                              {h.blurb}
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}

              <section className="atlas-panel rounded-xl p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <Users className="h-4 w-4" />
                  {admin ? "Quoting agents" : "Desk shortcuts"}
                </div>
                {admin ? (
                  <ul className="space-y-1 text-sm">
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
                      <Link
                        href="/air"
                        className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900"
                      >
                        Air
                      </Link>
                    ) : null}
                    {showSea ? (
                      <Link
                        href="/sea"
                        className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900"
                      >
                        Sea
                      </Link>
                    ) : null}
                  </div>
                )}
              </section>

              {!admin ? (
                <>
                  <section className="atlas-panel rounded-xl p-3">
                    <h2 className="mb-2 text-sm font-bold">My recent quotes</h2>
                    <ul className="max-h-40 space-y-1 overflow-auto text-sm">
                      {mine.slice(0, 8).map((e) => (
                        <li key={e.id}>
                          <Link
                            href={`/enquiries/?q=${encodeURIComponent(e.ref)}&select=${e.id}`}
                            className="flex justify-between rounded-md px-2 py-1 hover:bg-slate-50"
                          >
                            <span className="font-semibold text-sky-800">{e.ref}</span>
                            <span className="truncate text-[var(--color-text-muted)]">
                              {e.customer}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {mine.length === 0 ? (
                        <li className="text-[var(--color-text-muted)]">No quotes yet.</li>
                      ) : null}
                    </ul>
                    {nrsEntries.length > 0 ? (
                      <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                        <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                          NRS registry
                        </div>
                        <ul className="mt-1 text-xs">
                          {nrsEntries.slice(0, 4).map((n, i) => (
                            <li key={i}>
                              {n.shipper} → {n.consignee}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                </>
              ) : null}

              <details className="atlas-panel rounded-xl p-3">
                <summary className="cursor-pointer text-sm font-bold">Safety copies on this computer</summary>
                <div className="mt-2">
                  <p className="mb-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                    When you save a quote, Vertex also keeps a short list here. If the network
                    blips, you can reopen that quote from this browser — you do not need the file
                    name. Live history is always Enquiry DB / Ask Vertex.
                  </p>
                  <div className="mb-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOffline(listOfflineQuotes())}
                    >
                      Refresh
                    </Button>
                  </div>
                  {offline.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      No local copies yet. They appear after you save on Air or Sea.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {offline.slice(0, 6).map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5"
                        >
                          <Link
                            href={deskEditHref(o.type, o.id)}
                            className="min-w-0 truncate font-semibold text-sky-800 hover:underline"
                          >
                            <Badge tone="neutral">{o.type}</Badge> {o.customer || o.id}
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-700"
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
                </div>
              </details>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
