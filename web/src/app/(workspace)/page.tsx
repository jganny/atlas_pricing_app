"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Clock, FileClock, Inbox, PlaneTakeoff, Ship, Sparkles } from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { PerformanceReportPanel } from "@/components/PerformanceReportPanel";
import { HomeStartBox } from "@/components/HomeStartBox";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useHubJobs } from "@/hooks/use-hub-jobs";
import { useMyDrafts } from "@/hooks/use-drafts";
import { useScopedWonFollowUps } from "@/hooks/use-scoped-won-followups";
import { visibleJobs } from "@/lib/hub/jobs";
import { draftAge, draftIsStale } from "@/lib/quotes/drafts";
import { monthTotals, secondsLabel, sortAttention, teamPerformance, type AttentionItem } from "@/lib/home/summary";
import { wonRowsForViewer } from "@/lib/quotes/won-scope";
import { escalationTier, missingWonFields } from "@/lib/quotes/won-followups";
import { useAuthStore } from "@/store/auth";
import { canAccessRoute, deskFocusLabel, isNrsUser } from "@/lib/auth/rbac";
import { belongsToViewersDesk, currentDeskSeatId } from "@/lib/auth/desk-seats";
import {
  fetchAmendmentRequests,
  resolveAmendment,
  type AmendmentRequest,
} from "@/lib/firebase/amendments";
import { deskEditHref } from "@/lib/quotes/find-quotes";
import { listOfflineQuotes, removeOfflineQuote } from "@/lib/quotes/offline-cache";
import { NRS_CHANGED_EVENT, dismissNrsAlert, listNrsAlerts, type NrsAlert } from "@/lib/quotes/nrs-alerts";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { cn } from "@/lib/utils";
import { tint } from "@/lib/ui/colors";
import { demoLabel } from "@/lib/demo-mode";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: enquiries = [], isLoading, error, refetch } = useEnquiries();
  const { allRows: wonAll, quoteOf } = useScopedWonFollowUps();
  const { jobs: hubJobs } = useHubJobs();
  const drafts = useMyDrafts();
  const focus = deskFocusLabel(user?.username);
  const admin = isAdminUser(user?.username, user?.role);
  const username = (user?.username || "").toLowerCase();

  const [amendments, setAmendments] = useState<AmendmentRequest[]>([]);
  const [offline, setOffline] = useState(listOfflineQuotes());
  const [nrsAlerts, setNrsAlerts] = useState<NrsAlert[]>([]);

  useEffect(() => {
    try {
      setNrsAlerts(listNrsAlerts().filter((a) => !a.dismissed));
    } catch {
      /* ignore */
    }
  }, [username]);

  // The NRS desk's alerts are shared — refresh when the shared copy changes.
  useEffect(() => {
    const onNrs = () => setNrsAlerts(listNrsAlerts().filter((a) => !a.dismissed));
    window.addEventListener(NRS_CHANGED_EVENT, onNrs);
    return () => window.removeEventListener(NRS_CHANGED_EVENT, onNrs);
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
          belongsToViewersDesk(e, username) ||
          // Individual (non-desk) logins keep the looser name match; desk holders see exactly their desk.
          (!currentDeskSeatId(username) &&
            e.assignee?.toLowerCase().includes(focus.toLowerCase().slice(0, 4))),
      ),
    [enquiries, username, focus],
  );

  const totals = useMemo(() => monthTotals(enquiries, username, admin), [enquiries, username, admin]);
  const team = useMemo(() => {
    const all = teamPerformance(enquiries);
    if (admin) return all;
    const ownKey = currentDeskSeatId(username) ?? username;
    return all.filter((t) => t.key === ownKey);
  }, [enquiries, admin, username]);
  const teamMax = Math.max(1, ...team.map((t) => t.quoted));

  // Everything waiting on this user, most urgent first.
  const attentionAll = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const j of visibleJobs(hubJobs, username, false)) {
      if (j.status !== "waiting") continue;
      items.push({ id: `hub-${j.id}`, kind: "hub", title: `Quote hub: ${j.customer || "new enquiry"} · ${j.mode}`, sub: j.summary, tag: "new", tone: "new", href: "/quote", at: Date.parse(j.createdAt) || 0 });
    }
    for (const d of drafts) {
      items.push({ id: `draft-${d.id}`, kind: "draft", title: `${d.customer} · ${d.route}`, sub: `${d.waitingFor ? `Waiting for: ${d.waitingFor} · ` : ""}draft saved ${draftAge(d.savedAt)}`, tag: "draft", tone: draftIsStale(d.savedAt) ? "warn" : "new", href: `/${d.mode}/?draft=${encodeURIComponent(d.id)}`, at: d.savedAt });
    }
    const pendingWonRows = wonAll.filter((r) => missingWonFields(r).length > 0);
    const ownWon = admin ? pendingWonRows : wonRowsForViewer(pendingWonRows, username, false, quoteOf);
    if (admin) {
      if (ownWon.length) {
        const overdueCount = ownWon.filter((r) => escalationTier(r.wonAt) === "red").length;
        items.push({ id: "won-all", kind: "won", title: `${ownWon.length} won quote${ownWon.length === 1 ? "" : "s"} still missing details`, sub: overdueCount ? `${overdueCount} overdue · see by person` : "see by person", tag: "follow-ups", tone: overdueCount ? "late" : "warn", href: "/won-followups", at: 0 });
      }
    } else {
      for (const r of ownWon) {
        const tier = escalationTier(r.wonAt);
        items.push({ id: `won-${r.id}`, kind: "won", title: `Won: ${r.customer || r.ref}, details missing`, sub: missingWonFields(r).length + " detail(s) to fill", tag: tier === "red" ? "overdue" : "follow-up", tone: tier === "red" ? "late" : tier === "amber" ? "warn" : "new", href: "/won-followups", at: new Date(r.wonAt).getTime() || 0 });
      }
    }
    return items;
  }, [hubJobs, drafts, wonAll, quoteOf, admin, username]);
  const attention = useMemo(() => sortAttention(attentionAll, 6), [attentionAll]);

  const showAir = canAccessRoute(user?.username, user?.role, "air");
  const showSea = canAccessRoute(user?.username, user?.role, "sea");
  const showInbox = canAccessRoute(user?.username, user?.role, "inbox");
  const showEnquiries = canAccessRoute(user?.username, user?.role, "enquiries");

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

  const pendingAmd = amendments.filter((a) => a.status === "pending");

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
            {focus} · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} so far
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showAir ? (
            <Link
              href="/air"
              className="atlas-pop inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-atlas-navy)]"
            >
              <PlaneTakeoff className="h-3.5 w-3.5" /> Air desk
            </Link>
          ) : null}
          {showSea ? (
            <Link
              href="/sea"
              className="atlas-pop inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-atlas-navy)]"
            >
              <Ship className="h-3.5 w-3.5" /> Sea desk
            </Link>
          ) : null}
          {showInbox ? (
            <Link
              href="/inbox"
              className="atlas-pop inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-atlas-navy)] px-3 py-2 text-xs font-bold text-white"
            >
              <Inbox className="h-3.5 w-3.5" /> Inbox
            </Link>
          ) : null}
        </div>
      </div>

      <HomeStartBox />

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
          <div className="atlas-metric-strip" data-testid="home-tiles">
            <div className="atlas-metric-cell" style={{ backgroundColor: tint("#EF9F27", 0.14) }}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Waiting for you</div>
              <div className={cn("mt-1 text-2xl font-extrabold tabular-nums", attentionAll.length ? "text-amber-600" : "text-[var(--color-atlas-navy)]")}>{attentionAll.length}</div>
            </div>
            <div className="atlas-metric-cell" style={{ backgroundColor: tint("#378ADD", 0.14) }}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Quoted this month</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">{totals.quoted}</div>
            </div>
            <div className="atlas-metric-cell" style={{ backgroundColor: tint("#34A853", 0.14) }}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Won</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">{totals.won}</div>
            </div>
            <div className="atlas-metric-cell" style={{ backgroundColor: tint("#7F77DD", 0.14) }}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Won rate</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">{totals.wonPct}%</div>
            </div>
            <div className="atlas-metric-cell" style={{ backgroundColor: tint("#1D9E75", 0.14) }}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Avg. quote time</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--color-atlas-navy)]">{secondsLabel(totals.avgSeconds)}</div>
            </div>
          </div>

          <div className="atlas-workbench">
            <div className="space-y-4">
              <section className="atlas-panel overflow-hidden rounded-xl" data-testid="needs-you">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                  <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Needs you today</h2>
                  {showEnquiries ? (
                    <Link href="/enquiries" className="text-xs font-bold text-sky-800 hover:underline">
                      All quotes in Enquiry DB →
                    </Link>
                  ) : null}
                </div>
                <ul className="divide-y divide-[var(--color-border)]">
                  {attention.map((a) => {
                    const Icon = a.kind === "hub" ? Inbox : a.kind === "draft" ? FileClock : Bell;
                    return (
                      <li key={a.id}>
                        <Link href={a.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sky-50/50">
                          <Icon className={cn("h-4 w-4 shrink-0", a.tone === "late" ? "text-red-600" : a.tone === "warn" ? "text-amber-600" : "text-sky-700")} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--color-atlas-navy)]">{a.title}</div>
                            <div className="truncate text-xs text-[var(--color-text-muted)]">{a.sub}</div>
                          </div>
                          <Badge tone={a.tone === "late" ? "error" : a.tone === "warn" ? "warn" : "neutral"}>{a.tag}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                  {attention.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">Nothing is waiting on you. Drop an enquiry above to start.</li>
                  ) : null}
                </ul>
                {attentionAll.length > attention.length ? (
                  <div className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
                    + {attentionAll.length - attention.length} more. Open Quote hub, Drafts or Won follow-ups to see them all.
                  </div>
                ) : null}
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

              {!admin && isNrsUser(username) && nrsAlerts.length > 0 ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <h2 className="mb-2 text-sm font-extrabold text-amber-950">
                    {demoLabel("NRS confirmation alerts", "Priority follow-up alerts")}
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

              <section className="atlas-panel rounded-xl p-4" data-testid="team-month">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold text-[var(--color-atlas-navy)]">
                    <Sparkles className="h-4 w-4" />
                    {admin ? "Team this month" : "Your desk this month"}
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)]">quotes made · share won</span>
                </div>
                {team.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">No quotes yet this month.</p>
                ) : (
                  <ul className="space-y-2">
                    {team.map((t) => (
                      <li key={t.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,10rem)_1fr_4.5rem_4.5rem]">
                        <span className="truncate font-semibold">{t.label}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${t.label}: ${t.quoted} quotes made`}>
                          <div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.max(4, Math.round((t.quoted / teamMax) * 100))}%` }} />
                        </div>
                        <span className="hidden text-xs tabular-nums text-[var(--color-text-muted)] sm:block">{t.quoted} quoted</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums",
                            t.wonPct >= 25 ? "bg-emerald-100 text-emerald-900" : t.wonPct >= 15 ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900",
                          )}
                        >
                          {t.wonPct}% won
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {admin ? (
                <details className="atlas-panel rounded-xl px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-[var(--color-atlas-navy)]">
                    Full desk performance report
                  </summary>
                  <div className="mt-3">
                    <PerformanceReportPanel rows={enquiries} />
                  </div>
                </details>
              ) : null}
            </div>

            <aside className="space-y-3">
              {!admin ? (
                <section className="atlas-panel rounded-xl p-3">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4" /> My recent quotes
                  </h2>
                  <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                    {mine.slice(0, 8).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/enquiries/?q=${encodeURIComponent(e.ref)}&select=${e.id}`}
                          className="flex justify-between rounded-md px-2 py-1 hover:bg-slate-50"
                        >
                          <span className="font-semibold text-sky-800">{e.ref}</span>
                          <span className="truncate text-[var(--color-text-muted)]">{e.customer}</span>
                        </Link>
                      </li>
                    ))}
                    {mine.length === 0 ? <li className="text-[var(--color-text-muted)]">No quotes yet.</li> : null}
                  </ul>
                  {nrsEntries.length > 0 ? (
                    <div className="mt-3 border-t border-[var(--color-border)] pt-2">
                      <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                        {demoLabel("NRS registry", "Priority follow-ups")}
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
