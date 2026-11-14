"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, FileClock, Inbox } from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { PerformanceReportPanel } from "@/components/PerformanceReportPanel";
import { NeedsAttentionCard, TeamBoard } from "@/components/TeamBoard";
import { useInbox } from "@/hooks/use-atlas-data";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useEnquiries } from "@/hooks/use-atlas-data";
import { useHubJobs } from "@/hooks/use-hub-jobs";
import { useMyDrafts } from "@/hooks/use-drafts";
import { useScopedWonFollowUps } from "@/hooks/use-scoped-won-followups";
import { visibleJobs } from "@/lib/hub/jobs";
import { draftAge, draftIsStale } from "@/lib/quotes/drafts";
import { monthTotals, secondsLabel, sortAttention, teamPerformance, type AttentionItem } from "@/lib/home/summary";
import { homeDateLine, homeGreeting } from "@/lib/home/greeting";
import { wonRowsForViewer } from "@/lib/quotes/won-scope";
import { escalationTier, missingWonFields } from "@/lib/quotes/won-followups";
import { useAuthStore } from "@/store/auth";
import { canAccessRoute, deskFocusLabel, isNrsUser } from "@/lib/auth/rbac";
import { belongsToViewersDesk, currentDeskSeatId, personDisplayName } from "@/lib/auth/desk-seats";
import {
  fetchAmendmentRequests,
  resolveAmendment,
  type AmendmentRequest,
} from "@/lib/firebase/amendments";
import { deskEditHref } from "@/lib/quotes/find-quotes";
import { listOfflineQuotes, removeOfflineQuote } from "@/lib/quotes/offline-cache";
import { NRS_CHANGED_EVENT, dismissNrsAlert, listNrsAlerts, type NrsAlert } from "@/lib/quotes/nrs-alerts";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { canSeeInboxItem } from "@/lib/mail/inbox-assign";
import { workBarState } from "@/lib/mail/work-bar";
import { demoLabel } from "@/lib/demo-mode";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: enquiries = [], isLoading, error, refetch } = useEnquiries();
  const { allRows: wonAll, quoteOf } = useScopedWonFollowUps();
  const { jobs: hubJobs } = useHubJobs();
  const drafts = useMyDrafts();
  const focus = deskFocusLabel(user?.username);
  const admin = isAdminUser(user?.username, user?.role);
  const { data: inboxRows = [] } = useInbox();
  const [boardOpen, setBoardOpen] = useState(false);
  const username = (user?.username || "").toLowerCase();
  const givenName = personDisplayName(username);

  const [amendments, setAmendments] = useState<AmendmentRequest[]>([]);
  const [offline, setOffline] = useState(listOfflineQuotes());
  const [nrsAlerts, setNrsAlerts] = useState<NrsAlert[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      setNrsAlerts(listNrsAlerts().filter((a) => !a.dismissed));
    } catch {
      /* ignore */
    }
  }, [username]);

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

  const visibleInbox = useMemo(
    () => inboxRows.filter((r) => canSeeInboxItem(user?.username, user?.role, r, user?.email)),
    [inboxRows, user?.username, user?.role, user?.email],
  );
  const nextWork = useMemo(() => workBarState(visibleInbox, now), [visibleInbox, now]);

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

  function openNext() {
    if (!nextWork) return;
    try {
      window.sessionStorage.setItem("atlas_inbox_open", nextWork.id);
    } catch {
      /* Inbox opens on its first item */
    }
    router.push("/inbox");
  }

  const metrics = [
    { label: "Waiting", value: String(attentionAll.length) },
    { label: "Quoted this month", value: String(totals.quoted) },
    { label: "Won", value: String(totals.won) },
    { label: "Won rate", value: `${totals.wonPct}%` },
    { label: "Avg. quote time", value: secondsLabel(totals.avgSeconds) },
  ];

  return (
    <div className="min-h-full bg-white" data-testid="home-page">
      {boardOpen ? <TeamBoard rows={inboxRows} onClose={() => setBoardOpen(false)} /> : null}

      <div className="mx-auto max-w-[1080px] px-6 py-10 md:px-12 md:py-12">
        <header className="mb-10">
          <p className="text-[13px] leading-5 text-[#605e5c]">{homeGreeting(now)}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#201f1e]">{givenName}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-[#605e5c]">
            <span>
              {focus} · {homeDateLine(now)}
            </span>
            {admin ? <NeedsAttentionCard rows={inboxRows} onOpenBoard={() => setBoardOpen(true)} /> : null}
          </p>
        </header>

        {error ? (
          <Card className="mb-8 border-[#f3d6d6] bg-[#fdf6f6] py-3">
            <p className="text-sm font-semibold text-[#a4262c]">
              Could not load enquiries. Sign in with your Atlas desk credentials.
            </p>
          </Card>
        ) : null}

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {nextWork ? (
              <section
                data-testid="home-next"
                data-tone={nextWork.tone}
                className="mb-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-[#edebe9] pb-10"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#605e5c]">Next enquiry</div>
                  <h2 className="mt-1 truncate text-[20px] font-semibold leading-snug text-[#201f1e]">
                    {nextWork.headline.replace(/^Next:\s*/, "")}
                  </h2>
                  <p className="mt-1 text-[13px] leading-5 text-[#605e5c]">{nextWork.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={openNext}
                  data-testid="home-next-open"
                  className="inline-flex h-10 shrink-0 items-center rounded-[2px] bg-[#0078d4] px-5 text-[14px] font-semibold text-white hover:bg-[#106ebe]"
                >
                  Open
                </button>
              </section>
            ) : null}

            <dl data-testid="home-tiles" className="mb-10 grid grid-cols-2 gap-x-8 gap-y-6 border-b border-[#edebe9] pb-10 sm:grid-cols-3 lg:grid-cols-5">
              {metrics.map((m) => (
                <div key={m.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#605e5c]">{m.label}</dt>
                  <dd className="mt-1.5 text-[26px] font-semibold tabular-nums leading-none text-[#201f1e]">{m.value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
              <div className="space-y-10">
                <section data-testid="needs-you">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 className="text-[15px] font-semibold text-[#201f1e]">Waiting on you</h2>
                    {showEnquiries ? (
                      <Link href="/enquiries" className="text-[13px] text-[#0078d4] hover:underline">
                        Enquiry DB
                      </Link>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-[#edebe9] border-t border-[#edebe9]">
                    {attention.map((a) => {
                      const Icon = a.kind === "hub" ? Inbox : a.kind === "draft" ? FileClock : Clock;
                      return (
                        <li key={a.id}>
                          <Link href={a.href} className="flex items-start gap-3 py-3 hover:bg-[#faf9f8]">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#605e5c]" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-semibold text-[#201f1e]">{a.title}</div>
                              <div className="truncate text-[13px] text-[#605e5c]">{a.sub}</div>
                            </div>
                            <span className="shrink-0 pt-0.5 text-[12px] text-[#605e5c]">{a.tag}</span>
                          </Link>
                        </li>
                      );
                    })}
                    {attention.length === 0 ? (
                      <li className="py-8 text-[14px] text-[#605e5c]">Nothing is waiting on you.</li>
                    ) : null}
                  </ul>
                  {attentionAll.length > attention.length ? (
                    <p className="mt-2 text-[12px] text-[#605e5c]">
                      + {attentionAll.length - attention.length} more in Quote hub, Drafts or Won follow-ups.
                    </p>
                  ) : null}
                </section>

                {admin && pendingAmd.length > 0 ? (
                  <section>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h2 className="text-[15px] font-semibold text-[#201f1e]">Amendment approvals</h2>
                      <span className="text-[13px] tabular-nums text-[#605e5c]">{pendingAmd.length}</span>
                    </div>
                    <ul className="divide-y divide-[#edebe9] border-t border-[#edebe9]">
                      {pendingAmd.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold text-[#201f1e]">
                              {a.quoteRef || a.quoteId} · {a.customer || "—"}
                            </div>
                            <div className="text-[13px] text-[#605e5c]">
                              by {a.requestedBy}
                              {a.reason ? ` — ${a.reason}` : ""}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={() => void onResolve(a.id, "approved")}>
                              Approve
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => void onResolve(a.id, "rejected")}>
                              Reject
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {!admin && isNrsUser(username) && nrsAlerts.length > 0 ? (
                  <section>
                    <h2 className="mb-3 text-[15px] font-semibold text-[#201f1e]">
                      {demoLabel("NRS confirmation alerts", "Priority follow-up alerts")}
                    </h2>
                    <ul className="divide-y divide-[#edebe9] border-t border-[#edebe9]">
                      {nrsAlerts.map((a) => (
                        <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-[#201f1e]">{a.message}</div>
                            <div className="text-[13px] text-[#605e5c]">
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

                <section data-testid="team-month">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-semibold text-[#201f1e]">
                      {admin ? "This month" : "Your desk this month"}
                    </h2>
                    <span className="text-[12px] text-[#605e5c]">quotes made · share won</span>
                  </div>
                  {team.length === 0 ? (
                    <p className="border-t border-[#edebe9] py-8 text-[14px] text-[#605e5c]">No quotes yet this month.</p>
                  ) : (
                    <ul className="divide-y divide-[#edebe9] border-t border-[#edebe9]">
                      {team.map((t) => (
                        <li key={t.key} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-4 py-2.5 text-[14px] sm:grid-cols-[minmax(0,11rem)_1fr_5rem_4.5rem]">
                          <span className="truncate font-semibold text-[#201f1e]">{t.label}</span>
                          <div className="h-1.5 overflow-hidden bg-[#f3f2f1]" role="img" aria-label={`${t.label}: ${t.quoted} quotes made`}>
                            <div className="h-full bg-[#0078d4]" style={{ width: `${Math.max(4, Math.round((t.quoted / teamMax) * 100))}%` }} />
                          </div>
                          <span className="hidden text-[13px] tabular-nums text-[#605e5c] sm:block">{t.quoted} quoted</span>
                          <span className="text-right text-[13px] font-semibold tabular-nums text-[#201f1e]">{t.wonPct}% won</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {admin ? (
                  <details className="border-t border-[#edebe9] pt-3">
                    <summary className="cursor-pointer text-[14px] font-semibold text-[#201f1e]">
                      Full desk performance report
                    </summary>
                    <div className="mt-4">
                      <PerformanceReportPanel rows={enquiries} />
                    </div>
                  </details>
                ) : null}
              </div>

              <aside className="space-y-8 lg:border-l lg:border-[#edebe9] lg:pl-8">
                {!admin ? (
                  <section>
                    <h2 className="mb-3 text-[15px] font-semibold text-[#201f1e]">Recent quotes</h2>
                    <ul className="max-h-56 space-y-0 overflow-auto border-t border-[#edebe9] text-[14px]">
                      {mine.slice(0, 8).map((e) => (
                        <li key={e.id} className="border-b border-[#edebe9]">
                          <Link
                            href={`/enquiries/?q=${encodeURIComponent(e.ref)}&select=${e.id}`}
                            className="flex justify-between gap-3 py-2 hover:bg-[#faf9f8]"
                          >
                            <span className="font-semibold text-[#0078d4]">{e.ref}</span>
                            <span className="truncate text-[#605e5c]">{e.customer}</span>
                          </Link>
                        </li>
                      ))}
                      {mine.length === 0 ? <li className="py-6 text-[#605e5c]">No quotes yet.</li> : null}
                    </ul>
                    {nrsEntries.length > 0 ? (
                      <div className="mt-6">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#605e5c]">
                          {demoLabel("NRS registry", "Priority follow-ups")}
                        </div>
                        <ul className="mt-2 space-y-1 text-[13px] text-[#201f1e]">
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

                <details>
                  <summary className="cursor-pointer text-[14px] font-semibold text-[#201f1e]">Safety copies on this computer</summary>
                  <div className="mt-3">
                    <p className="mb-3 text-[13px] leading-6 text-[#605e5c]">
                      When you save a quote, Vertex also keeps a short list here. If the network
                      blips, you can reopen that quote from this browser. Live history is always Enquiry DB.
                    </p>
                    <div className="mb-2 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setOffline(listOfflineQuotes())}>
                        Refresh
                      </Button>
                    </div>
                    {offline.length === 0 ? (
                      <p className="text-[13px] text-[#605e5c]">No local copies yet. They appear after you save on Air or Sea.</p>
                    ) : (
                      <ul className="space-y-1 text-[13px]">
                        {offline.slice(0, 6).map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                            <Link href={deskEditHref(o.type, o.id)} className="min-w-0 truncate font-semibold text-[#0078d4] hover:underline">
                              <Badge tone="neutral">{o.type}</Badge> {o.customer || o.id}
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-[#a4262c]"
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
    </div>
  );
}
