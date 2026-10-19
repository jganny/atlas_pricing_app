"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { activityDay, formatDay, sortActivities, todayISO, visitProblem } from "@/lib/sales/activity-log";
import { toast } from "@/components/Toast";
import { useAccounts, useEnquiries, useLeads, useSalesContacts } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useDeskSaveShortcut } from "@/hooks/use-desk-save-shortcut";
import { useAuthStore } from "@/store/auth";
import { useLeadHandovers } from "@/hooks/use-lead-handovers";
import { canDeleteActivity, deleteMinutesLeft, isHandover, visitCandidates, type VisitCandidate } from "@/lib/sales/visit-flow";
import { canEditLead, canViewOwned, visibleToUser } from "@/lib/auth/sales-access";
import { logAudit } from "@/lib/firebase/audit-log";
import { diffFields } from "@/lib/audit/audit-entry";
import { useLiveData } from "@/lib/api";
import {
  addLeadActivity,
  deleteLeadActivity,
  fetchLeadActivities,
  saveLead,
  updateLeadStatus,
} from "@/lib/firebase/sales";
import { mockApi } from "@/lib/mock/api";
import { TEAM_ROLES, isAdminUser } from "@/lib/quotes/team-roles";
import {
  LEAD_SOURCES,
  deskHrefsForLead,
  effectiveLeadModes,
  isFollowUpDue,
  quotesForCompany,
  stashLeadDeskPrefill,
} from "@/lib/sales/quote-from-lead";
import { LOSS_REASON_CODES, lossReasonLabel } from "@/lib/sales/loss-reasons";
import { computeLeadScore, scoreTone } from "@/lib/sales/lead-scoring";
import type { LeadActivity, LeadStatus, SalesLead } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "quoted", "won", "lost"];

const EMPTY_FORM = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  source: "",
  modes: ["air"] as NonNullable<SalesLead["modes"]>,
  dealValue: 0,
  nextAction: "",
  nextDueDate: "",
  owner: "",
  winLossReason: "",
};

function ScoreBadge({ lead }: { lead: SalesLead }) {
  const score = computeLeadScore(lead);
  const title = score.factors.map((f) => `${f.points > 0 ? "+" : ""}${f.points} ${f.label}`).join("\n");
  return (
    <span title={title || "No scoring factors yet"}>
      <Badge tone={scoreTone(score.total)}>{score.total}</Badge>
    </span>
  );
}

/**
 * Lead pipeline — capture, board/list views, activity log, quote-from-lead.
 * Moved out of sales/page.tsx near-verbatim so /sales could grow tabs
 * (Pipeline / Accounts / …) without disturbing this view's own logic.
 */
export function PipelineView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: rawLeads = [], isLoading } = useLeads();
  // Only my own leads (plus any legacy, ownerless ones) — an admin sees
  // every rep's pipeline, a rep sees only their own.
  const leads = useMemo(
    () => visibleToUser(rawLeads, user?.username, user?.role),
    [rawLeads, user?.username, user?.role],
  );
  const { data: enquiries = [] } = useEnquiries();
  const { data: accounts = [] } = useAccounts();
  const [view, setView] = useState<"list" | "board">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<LeadActivity["type"]>("meeting");
  const [noteDate, setNoteDate] = useState(() => todayISO());
  const [nextStep, setNextStep] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [noteError, setNoteError] = useState("");
  const [visiting, setVisiting] = useState(false);
  const [visitQuery, setVisitQuery] = useState("");
  const [showAllActs, setShowAllActs] = useState(false);
  const [focusVisit, setFocusVisit] = useState(false);
  const admin = isAdminUser(user?.username, user?.role);
  const handovers = useLeadHandovers(admin);
  const canViewAccount = (a: { owner?: string }) => canViewOwned(user?.username, user?.role, a.owner);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<SalesLead | null>(null);
  const { data: editContacts = [] } = useSalesContacts(editForm?.accountId);
  const [collapsedCols, setCollapsedCols] = useState<Set<LeadStatus>>(() => {
    try {
      const raw = localStorage.getItem("atlas_pipeline_collapsed_cols");
      return raw ? new Set(JSON.parse(raw) as LeadStatus[]) : new Set();
    } catch {
      return new Set();
    }
  });

  function toggleColumnCollapsed(status: LeadStatus) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      try {
        localStorage.setItem("atlas_pipeline_collapsed_cols", JSON.stringify([...next]));
      } catch {
        // per-browser convenience only — a failed write just means the
        // collapsed state won't be remembered next visit
      }
      return next;
    });
  }

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const linkedQuotes = useMemo(
    () => enquiries.filter((q) => selected?.quoteIds?.includes(q.id)),
    [enquiries, selected?.quoteIds],
  );
  const relatedQuotes = useMemo(() => {
    const linkedIds = new Set(linkedQuotes.map((q) => q.id));
    return quotesForCompany(enquiries, selected?.company).filter((q) => !linkedIds.has(q.id));
  }, [enquiries, selected?.company, linkedQuotes]);
  const selectedAccount = accounts.find((a) => a.id === selected?.accountId) ?? null;
  const canEditSelected = selected ? canEditLead(user?.username, user?.role, selected) : false;

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${lead.company} ${lead.contactName || ""} ${lead.owner || ""} ${effectiveLeadModes(lead).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [leads, query, statusFilter]);

  const followUps = useMemo(() => leads.filter((l) => isFollowUpDue(l)), [leads]);

  const stats = useMemo(() => {
    const open = leads.filter((l) => l.status !== "lost" && l.status !== "won");
    const pipeline = open.reduce((s, l) => s + (l.dealValue || 0), 0);
    const won = leads.filter((l) => l.status === "won").reduce((s, l) => s + (l.dealValue || 0), 0);
    return { count: leads.length, pipeline, won, followUps: followUps.length };
  }, [leads, followUps.length]);

  async function openLead(lead: SalesLead) {
    setSelectedId(lead.id);
    setEditing(false);
    setEditForm(null);
    try {
      if (useLiveData) {
        const rows = await Promise.race([
          fetchLeadActivities(lead.id),
          new Promise<LeadActivity[]>((resolve) => setTimeout(() => resolve([]), 4000)),
        ]);
        if (rows.length) setActivities(sortActivities(rows));
        else setActivities(await mockApi.fetchLeadActivities(lead.id));
      } else {
        setActivities(await mockApi.fetchLeadActivities(lead.id));
      }
    } catch {
      setActivities(await mockApi.fetchLeadActivities(lead.id));
    }
  }

  async function moveLead(id: string, status: LeadStatus) {
    const target = leads.find((l) => l.id === id);
    if (target && !canEditLead(user?.username, user?.role, target)) {
      toast(`Only ${TEAM_ROLES[target.owner || ""]?.name || target.owner} or an admin can move this lead`, "error");
      return;
    }
    setBusy(true);
    try {
      if (useLiveData) {
        try {
          await Promise.race([
            updateLeadStatus(id, status),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* local */
        }
      }
      queryClient.setQueryData(
        queryKeys.leads,
        rawLeads.map((l) =>
          l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l,
        ),
      );
      if (target && target.status !== status) {
        logAudit({
          action: "lead.status",
          entityType: "lead",
          entityId: id,
          entityLabel: target.company,
          changes: { status: { from: target.status, to: status } },
        });
      }
      toast(`Moved to ${status}`, "success");
    } finally {
      setBusy(false);
    }
  }

  async function createLead() {
    if (!form.company.trim()) {
      toast("Company is required", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        company: form.company,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        source: form.source,
        status: "new" as LeadStatus,
        modes: form.modes,
        dealValue: form.dealValue,
        nextAction: form.nextAction,
        nextDueDate: form.nextDueDate,
        owner: form.owner || user?.username || "",
        winLossReason: form.winLossReason,
      };
      let id = `lead-local-${Date.now()}`;
      if (useLiveData) {
        try {
          id = await Promise.race([
            saveLead(payload),
            new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* keep local id */
        }
      }
      const row: SalesLead = {
        id,
        ...payload,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(queryKeys.leads, [row, ...rawLeads]);
      logAudit({ action: "lead.create", entityType: "lead", entityId: id, entityLabel: row.company, summary: `New lead ${row.company}` });
      // A lead given to another sales person is reported to the admin.
      if (isHandover(user?.username, payload.owner)) {
        logAudit({
          action: "lead.handover",
          entityType: "lead",
          entityId: id,
          entityLabel: row.company,
          summary: `${TEAM_ROLES[(user?.username || "").toLowerCase()]?.name || user?.username} gave ${row.company} to ${TEAM_ROLES[payload.owner]?.name || payload.owner}`,
          changes: { owner: { from: (user?.username || "").toLowerCase(), to: payload.owner } },
        });
      }
      setCreating(false);
      setForm({ ...EMPTY_FORM, owner: user?.username || "" });
      toast("Lead created", "success");
    } finally {
      setBusy(false);
    }
  }

  async function postNote() {
    if (!selected) return;
    const problem = visitProblem({ body: note, activityDate: noteDate, nextStep, followUpDate: followUp });
    if (problem) {
      setNoteError(problem);
      return;
    }
    setNoteError("");
    setBusy(true);
    try {
      const body = note.trim();
      const extra = { activityDate: noteDate, nextStep: nextStep.trim() || undefined, followUpDate: followUp || undefined };
      if (useLiveData) {
        try {
          await Promise.race([
            addLeadActivity(selected.id, body, user?.username || "desk", noteType, extra),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* local */
        }
      }
      setActivities((a) =>
        sortActivities([
          {
            id: `act-${Date.now()}`,
            leadId: selected.id,
            type: noteType,
            body,
            createdBy: user?.username,
            createdAt: new Date().toISOString(),
            ...extra,
          },
          ...a,
        ]),
      );
      setNote("");
      setNextStep("");
      setFollowUp("");
      setNoteDate(todayISO());
      toast("Visit logged", "success");
    } finally {
      setBusy(false);
    }
  }

  function quoteFromLead(lead: SalesLead, mode?: SalesLead["mode"]) {
    stashLeadDeskPrefill(lead, mode);
    const chosen = mode ?? effectiveLeadModes(lead)[0];
    const links = deskHrefsForLead(lead);
    const href = links.find((d) => d.mode === chosen)?.href ?? links[0]?.href ?? "/air/";
    router.push(chosen === "air" || chosen === "sea" || !chosen ? `${href}${href.includes("?") ? "&" : "?"}smart=1` : href);
  }

  /** Log a visit to a company that's already known: open its lead (making one from an account if needed). */
  async function startVisit(c: VisitCandidate) {
    setVisiting(false);
    setVisitQuery("");
    setFocusVisit(true);
    if (c.kind === "lead") {
      const lead = leads.find((l) => l.id === c.id);
      if (lead) await openLead(lead);
      return;
    }
    const account = accounts.find((a) => a.id === c.id);
    if (!account) return;
    setBusy(true);
    try {
      const payload = {
        company: account.name,
        contactName: "",
        email: "",
        phone: "",
        source: "Existing account",
        status: "contacted" as LeadStatus,
        modes: ["air"] as NonNullable<SalesLead["modes"]>,
        dealValue: 0,
        nextAction: "",
        nextDueDate: "",
        owner: user?.username || "",
        winLossReason: "",
        accountId: account.id,
      };
      let id = `lead-local-${Date.now()}`;
      if (useLiveData) {
        try {
          id = await Promise.race([
            saveLead(payload),
            new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* keep local id */
        }
      }
      const row: SalesLead = { id, ...payload, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
      queryClient.setQueryData(queryKeys.leads, [row, ...rawLeads]);
      logAudit({ action: "lead.create", entityType: "lead", entityId: id, entityLabel: row.company, summary: `Visit to existing account ${row.company}` });
      await openLead(row);
    } finally {
      setBusy(false);
    }
  }

  async function deleteActivity(a: LeadActivity) {
    if (!canDeleteActivity(a, user?.username, admin)) {
      toast(admin ? "This entry can't be deleted." : "Entries can be deleted by their author for 2 hours. After that, ask the admin.", "error");
      return;
    }
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    try {
      if (useLiveData) await deleteLeadActivity(a.id);
    } catch {
      toast("Couldn't delete that entry. Check your connection and try again.", "error");
      return;
    }
    setActivities((rows) => rows.filter((x) => x.id !== a.id));
    if (selected) {
      logAudit({
        action: "lead.visit.delete",
        entityType: "lead",
        entityId: selected.id,
        entityLabel: selected.company,
        summary: `Deleted a ${a.type} entry (${activityDay(a)}) by ${a.createdBy || "unknown"}`,
      });
    }
    toast("Entry deleted", "success");
  }

  // After choosing a lead, bring its panel into view so nobody has to scroll down to find it.
  useEffect(() => {
    if (!selectedId) return;
    const t = window.setTimeout(() => {
      document.getElementById("lead-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusVisit) {
        document.getElementById("visit-notes")?.focus({ preventScroll: true });
        setFocusVisit(false);
      }
    }, 150);
    return () => window.clearTimeout(t);
  }, [selectedId, focusVisit]);

  function startEdit(lead: SalesLead) {
    setEditForm({ ...lead });
    setEditing(true);
  }

  async function saveLeadEdit() {
    if (!editForm) return;
    if (!editForm.company.trim()) {
      toast("Company is required", "error");
      return;
    }
    if ((editForm.status === "lost") && !editForm.lossReasonCode) {
      toast("Pick a loss reason before saving a lost lead", "error");
      return;
    }
    setBusy(true);
    try {
      const { id, updatedAt: _updatedAt, createdAt: _createdAt, ...rest } = editForm;
      await saveLead({ ...rest, id });
      const before = rawLeads.find((l) => l.id === id);
      const changes = before
        ? diffFields(before as unknown as Record<string, unknown>, editForm as unknown as Record<string, unknown>, [
            "company", "contactName", "phone", "email", "dealValue", "nextAction", "nextDueDate",
            "accountId", "contactId", "probability", "expectedCloseDate", "lossReasonCode", "lossReasonNotes",
          ])
        : {};
      if (Object.keys(changes).length) {
        logAudit({ action: "lead.update", entityType: "lead", entityId: id, entityLabel: editForm.company, changes });
      }
      queryClient.setQueryData(
        queryKeys.leads,
        rawLeads.map((l) => (l.id === id ? { ...editForm, updatedAt: new Date().toISOString() } : l)),
      );
      setEditing(false);
      setEditForm(null);
      toast("Lead saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save lead", "error");
    } finally {
      setBusy(false);
    }
  }

  useDeskSaveShortcut(() => void saveLeadEdit(), editing && !busy);

  const owners = Object.keys(TEAM_ROLES).filter((k) => k !== "ganny");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Pipeline, follow-ups, and quote from lead — same records as legacy Sales.
        </p>
        <div className="flex gap-2">
          <Button type="button" className="gap-1.5" onClick={() => { setVisiting((v) => !v); setCreating(false); }} data-testid="new-visit">
            <Plus className="h-4 w-4" />
            New visit
          </Button>
          <Button type="button" variant="secondary" className="gap-1.5" onClick={() => { setCreating(true); setVisiting(false); }}>
            <Plus className="h-4 w-4" />
            New lead
          </Button>
        </div>
      </div>

      {visiting ? (
        <Card className="border-sky-200 bg-sky-50/40">
          <h2 className="font-bold">New visit</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            For a company you already deal with. Not in the list? Use <b>New lead</b> instead.
          </p>
          <Input
            autoFocus
            className="mt-2"
            aria-label="Company visited"
            placeholder="Start typing the company name"
            value={visitQuery}
            onChange={(e) => setVisitQuery(e.target.value)}
          />
          <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-white text-sm">
            {visitQuery.trim().length < 2 ? (
              <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Type at least two letters.</li>
            ) : visitCandidates(leads, accounts.filter((a) => canViewAccount(a)), visitQuery).length === 0 ? (
              <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No existing company matches. Use New lead for a new company.</li>
            ) : (
              visitCandidates(leads, accounts.filter((a) => canViewAccount(a)), visitQuery).map((c) => (
                <li key={c.key}>
                  <button type="button" className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50" onClick={() => void startVisit(c)}>
                    <span className="font-semibold text-[var(--color-atlas-navy)]">{c.company}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{c.detail}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>
      ) : null}

      {admin && handovers.entries.length ? (
        <Card className={cn("py-2.5", handovers.unseen ? "border-amber-300 bg-amber-50" : "border-[var(--color-border)]")}>
          <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) handovers.markSeen(); }}>
            <summary className="cursor-pointer text-sm font-bold text-[var(--color-atlas-navy)]">
              Lead handovers
              {handovers.unseen ? <span className="ml-2 rounded-full bg-[var(--color-atlas-error)] px-2 py-0.5 text-[10px] font-extrabold text-white">{handovers.unseen} new</span> : null}
              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">leads one sales person gave to another</span>
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {handovers.entries.slice(0, 20).map((h) => (
                <li key={h.id}>
                  <span className="text-xs text-[var(--color-text-muted)]">{new Date(h.atIso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · </span>
                  <b>{TEAM_ROLES[h.from]?.name || h.from}</b> gave <b>{h.company}</b> to <b>{TEAM_ROLES[h.to]?.name || h.to}</b>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm sm:grid-cols-4" data-testid="sales-kpi-strip">
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Leads</div>
          <div className="text-lg font-extrabold">{stats.count}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Open pipeline</div>
          <div className="text-sm font-extrabold">{formatCurrency(stats.pipeline, "INR")}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Won</div>
          <div className="text-sm font-extrabold text-emerald-700">{formatCurrency(stats.won, "INR")}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Follow-ups due</div>
          <div className="text-lg font-extrabold text-amber-600">{stats.followUps}</div>
        </div>
      </div>

      {followUps.length ? (
        <Card className="border-amber-200 bg-amber-50/50 py-2.5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">Needs follow-up</p>
          <ul className="mt-1 space-y-1 text-sm">
            {followUps.slice(0, 5).map((l) => (
              <li key={l.id}>
                <button type="button" className="font-semibold text-sky-800" onClick={() => void openLead(l)}>
                  {l.company}
                </button>
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  · {l.nextAction || "Follow up"} · due {l.nextDueDate}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {creating ? (
        <Card className="border-sky-200 bg-sky-50/40">
          <h2 className="font-bold">New lead</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Company *</Label>
              <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                <option value="">—</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Owner</Label>
              <Select value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}>
                <option value="">—</option>
                {owners.map((id) => (
                  <option key={id} value={id}>
                    {TEAM_ROLES[id]?.name || id}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Mode — pick every mode this enquiry could quote as</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {(["air", "sea", "courier", "transport", "warehouse"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 text-sm font-medium capitalize">
                    <input
                      type="checkbox"
                      checked={form.modes.includes(m)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          modes: e.target.checked
                            ? [...f.modes, m]
                            : f.modes.filter((x) => x !== m),
                        }))
                      }
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Deal value (INR)</Label>
              <Input
                type="number"
                value={form.dealValue}
                onChange={(e) => setForm((f) => ({ ...f, dealValue: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Next action</Label>
              <Input value={form.nextAction} onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))} />
            </div>
            <div>
              <Label>Follow-up date</Label>
              <Input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void createLead()}>
              Create
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5 text-xs font-bold">
          <button
            type="button"
            className={cn("rounded-md px-2.5 py-1", view === "list" ? "bg-[var(--color-atlas-navy)] text-white" : "")}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={cn("rounded-md px-2.5 py-1", view === "board" ? "bg-[var(--color-atlas-navy)] text-white" : "")}
            onClick={() => setView("board")}
          >
            Board
          </button>
        </div>
        <input
          className="min-w-[12rem] flex-1 rounded-md border px-2.5 py-1.5 text-sm"
          placeholder="Search company, contact, mode, owner…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {(["all", ...STAGES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                statusFilter === s
                  ? "bg-[var(--color-atlas-navy)] text-white"
                  : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card>Loading pipeline…</Card>
      ) : view === "list" ? (
        <div
          className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white"
          role="region"
          aria-label="Leads table"
          tabIndex={0}
        >
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Lane / mode</th>
                <th className="px-3 py-2">Deal (INR)</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    No leads in this view.
                  </td>
                </tr>
              ) : (
                visible.map((lead) => (
                  <tr
                    key={lead.id}
                    className={cn(
                      "cursor-pointer border-b last:border-0 hover:bg-slate-50",
                      selectedId === lead.id && "bg-sky-50",
                    )}
                    onClick={() => void openLead(lead)}
                  >
                    <td className="px-3 py-2">
                      <ScoreBadge lead={lead} />
                    </td>
                    <td className="px-3 py-2 font-semibold">{lead.company}</td>
                    <td className="px-3 py-2">{lead.contactName || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={lead.status === "won" ? "success" : lead.status === "lost" ? "neutral" : "warn"}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {effectiveLeadModes(lead).map((m) => m.toUpperCase()).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {lead.dealValue ? formatCurrency(lead.dealValue, "INR") : "—"}
                    </td>
                    <td className="px-3 py-2">{TEAM_ROLES[lead.owner || ""]?.name || lead.owner || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {isFollowUpDue(lead) ? (
                        <span className="font-bold text-amber-700">Due {lead.nextDueDate}</span>
                      ) : (
                        lead.nextDueDate || "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((status) => {
            const col = visible.filter((l) => l.status === status);
            return (
              <div
                key={status}
                className="w-56 shrink-0 rounded-xl border border-[var(--color-border)] bg-slate-50/80 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/lead-id");
                  if (id) void moveLead(id, status);
                }}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => toggleColumnCollapsed(status)}
                    className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-600"
                    title={collapsedCols.has(status) ? "Expand column" : "Collapse column"}
                  >
                    <span className="inline-block w-3 text-slate-400">{collapsedCols.has(status) ? "▸" : "▾"}</span>
                    {status}
                  </button>
                  <Badge tone="neutral">{col.length}</Badge>
                </div>
                <div className={cn("space-y-2", collapsedCols.has(status) && "hidden")}>
                  {col.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      draggable={canEditLead(user?.username, user?.role, lead)}
                      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
                      onClick={() => void openLead(lead)}
                      className={cn(
                        "w-full rounded-lg border bg-white p-2.5 text-left text-sm shadow-sm",
                        selectedId === lead.id
                          ? "border-[var(--color-atlas-sky)] ring-2 ring-sky-100"
                          : "border-[var(--color-border)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="font-bold text-[var(--color-atlas-navy)]">{lead.company}</div>
                        <ScoreBadge lead={lead} />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {lead.contactName || "—"} · {effectiveLeadModes(lead).join(", ") || "—"}
                      </div>
                      {lead.dealValue ? (
                        <div className="mt-1 text-xs font-semibold">{formatCurrency(lead.dealValue, "INR")}</div>
                      ) : null}
                      {isFollowUpDue(lead) ? (
                        <div className="mt-1 text-[10px] font-bold text-amber-700">Follow-up due</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && editing && editForm ? (
        <Card className="border-sky-200 bg-sky-50/40">
          <h2 className="font-bold">Edit lead</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Company *</Label>
              <Input value={editForm.company} onChange={(e) => setEditForm((f) => f && { ...f, company: e.target.value })} />
            </div>
            <div>
              <Label>Contact</Label>
              <Input value={editForm.contactName || ""} onChange={(e) => setEditForm((f) => f && { ...f, contactName: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone || ""} onChange={(e) => setEditForm((f) => f && { ...f, phone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email || ""} onChange={(e) => setEditForm((f) => f && { ...f, email: e.target.value })} />
            </div>
            <div>
              <Label>Deal value (INR)</Label>
              <Input
                type="number"
                value={editForm.dealValue || 0}
                onChange={(e) => setEditForm((f) => f && { ...f, dealValue: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Next action</Label>
              <Input value={editForm.nextAction || ""} onChange={(e) => setEditForm((f) => f && { ...f, nextAction: e.target.value })} />
            </div>
            <div>
              <Label>Follow-up date</Label>
              <Input
                type="date"
                value={editForm.nextDueDate || ""}
                onChange={(e) => setEditForm((f) => f && { ...f, nextDueDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Account</Label>
              <Select
                value={editForm.accountId || ""}
                onChange={(e) => setEditForm((f) => f && { ...f, accountId: e.target.value || undefined, contactId: undefined })}
              >
                <option value="">— none —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Contact (on account)</Label>
              <Select
                value={editForm.contactId || ""}
                disabled={!editForm.accountId}
                onChange={(e) => setEditForm((f) => f && { ...f, contactId: e.target.value || undefined })}
              >
                <option value="">— none —</option>
                {editContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Win probability % (blank = stage default)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editForm.probability ?? ""}
                onChange={(e) =>
                  setEditForm((f) => f && { ...f, probability: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Expected close date</Label>
              <Input
                type="date"
                value={editForm.expectedCloseDate || ""}
                onChange={(e) => setEditForm((f) => f && { ...f, expectedCloseDate: e.target.value })}
              />
            </div>
            {editForm.status === "lost" ? (
              <>
                <div>
                  <Label>Loss reason *</Label>
                  <Select
                    value={editForm.lossReasonCode || ""}
                    onChange={(e) => setEditForm((f) => f && { ...f, lossReasonCode: e.target.value })}
                  >
                    <option value="">— select —</option>
                    {LOSS_REASON_CODES.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Loss notes</Label>
                  <Input
                    value={editForm.lossReasonNotes || ""}
                    onChange={(e) => setEditForm((f) => f && { ...f, lossReasonNotes: e.target.value })}
                  />
                </div>
              </>
            ) : null}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setEditForm(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void saveLeadEdit()}>
              Save lead
            </Button>
          </div>
        </Card>
      ) : null}

      {selected && !editing ? (
        <Card id="lead-panel" className="scroll-mt-16">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-[var(--color-atlas-navy)]">{selected.company}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {selected.contactName || "No contact"}
                {selected.phone ? ` · ${selected.phone}` : ""}
                {selected.email ? ` · ${selected.email}` : ""}
                {selected.source ? ` · ${selected.source}` : ""}
              </p>
              <p className="mt-1 text-sm">
                {effectiveLeadModes(selected).join(", ") || "—"} ·{" "}
                {selected.dealValue ? formatCurrency(selected.dealValue, "INR") : "no value"}
              </p>
              {selectedAccount ? (
                <p className="mt-1 text-sm">
                  Account: <span className="font-semibold">{selectedAccount.name}</span>
                </p>
              ) : null}
              {selected.probability != null || selected.expectedCloseDate ? (
                <p className="mt-1 text-sm">
                  {selected.probability != null ? `${selected.probability}% probability` : null}
                  {selected.probability != null && selected.expectedCloseDate ? " · " : null}
                  {selected.expectedCloseDate ? `Expected close ${selected.expectedCloseDate}` : null}
                </p>
              ) : null}
              {selected.nextAction ? (
                <p className="mt-1 text-sm">
                  Next: {selected.nextAction}
                  {selected.nextDueDate ? ` · ${selected.nextDueDate}` : ""}
                </p>
              ) : null}
              {selected.status === "lost" && selected.lossReasonCode ? (
                <p className="mt-1 text-sm text-slate-600">
                  Lost: {lossReasonLabel(selected.lossReasonCode)}
                  {selected.lossReasonNotes ? ` — ${selected.lossReasonNotes}` : ""}
                </p>
              ) : selected.winLossReason ? (
                <p className="mt-1 text-sm text-slate-600">Win/loss: {selected.winLossReason}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                className="w-36"
                value={selected.status}
                disabled={!canEditSelected}
                onChange={(e) => void moveLead(selected.id, e.target.value as LeadStatus)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              {canEditSelected ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(selected)}>
                  Edit
                </Button>
              ) : (
                <span className="self-center text-[11px] font-semibold text-[var(--color-text-muted)]">
                  View only — owned by {TEAM_ROLES[selected.owner || ""]?.name || selected.owner}
                </span>
              )}
              {effectiveLeadModes(selected).length > 1 ? (
                effectiveLeadModes(selected).map((m) => (
                  <Button key={m} type="button" size="sm" onClick={() => quoteFromLead(selected, m)}>
                    Quote ({m})
                  </Button>
                ))
              ) : (
                <Button type="button" size="sm" onClick={() => quoteFromLead(selected)}>
                  Quote from lead
                </Button>
              )}
            </div>
          </div>

          {selected.status === "lost" && !selected.lossReasonCode && canEditSelected ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">
              No loss reason on file —{" "}
              <button type="button" className="underline" onClick={() => startEdit(selected)}>
                add one
              </button>
              .
            </p>
          ) : null}

          <h3 className="mt-4 border-t border-[var(--color-border)] pt-3 text-sm font-bold">Log a visit</h3>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="mt-0 w-36"
                aria-label="Type of activity"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as LeadActivity["type"])}
              >
                <option value="meeting">Meeting / visit</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="note">Note</option>
              </Select>
              <Input
                type="date"
                className="mt-0 w-40"
                aria-label="Date of the visit"
                value={noteDate}
                max={todayISO()}
                onChange={(e) => setNoteDate(e.target.value)}
              />
              <span className="text-xs text-[var(--color-text-muted)]">Today unless you change it</span>
            </div>
            <Textarea
              id="visit-notes"
              rows={4}
              className="mt-0"
              aria-label="What was discussed"
              placeholder="What was discussed — requirements, lanes, volumes, rates asked, objections, who attended…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="mt-0 min-w-[12rem] flex-1"
                aria-label="Next step"
                placeholder="Next step (optional) — e.g. send Air rate by Friday"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
              />
              <Input
                type="date"
                className="mt-0 w-40"
                aria-label="Follow-up date"
                value={followUp}
                min={noteDate}
                onChange={(e) => setFollowUp(e.target.value)}
              />
              <Button type="button" disabled={busy} onClick={() => void postNote()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save visit"}
              </Button>
            </div>
            {noteError ? (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {noteError}
              </p>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {activities.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No activities yet.</li>
            ) : (
              (showAllActs ? activities : activities.slice(0, 5)).map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{a.type}</Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDay(activityDay(a))} · logged by {a.createdBy || "—"}
                    </span>
                    {canDeleteActivity(a, user?.username, admin) ? (
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        title={admin ? "Delete this entry" : `You can delete this for ${deleteMinutesLeft(a)} more minute(s)`}
                        onClick={() => void deleteActivity(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                        {!admin ? <span className="font-normal text-[var(--color-text-muted)]"> · {deleteMinutesLeft(a) >= 60 ? `${Math.floor(deleteMinutesLeft(a) / 60)}h ${deleteMinutesLeft(a) % 60}m` : `${deleteMinutesLeft(a)}m`} left</span> : null}
                      </button>
                    ) : null}
                  </div>
                  {a.body ? <div className="mt-1 whitespace-pre-wrap">{a.body}</div> : null}
                  {a.nextStep || a.followUpDate ? (
                    <div className="mt-1 text-xs font-semibold text-[var(--color-atlas-navy)]">
                      Next: {a.nextStep || "follow up"}
                      {a.followUpDate ? ` · ${formatDay(a.followUpDate)}` : ""}
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          {activities.length > 5 ? (
            <button type="button" className="mt-2 text-xs font-semibold text-sky-800 underline" onClick={() => setShowAllActs((v) => !v)}>
              {showAllActs ? "Show fewer" : `Show all ${activities.length} entries`}
            </button>
          ) : null}

          {linkedQuotes.length ? (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-extrabold uppercase text-emerald-900">Linked quotes</p>
              <ul className="mt-1 space-y-1 text-sm">
                {linkedQuotes.map((q) => (
                  <li key={q.id}>
                    <Link className="font-semibold text-sky-800" href={`/enquiries/?q=${encodeURIComponent(q.ref)}&select=${encodeURIComponent(q.id)}`}>
                      {q.ref}
                    </Link>{" "}
                    · {q.mode.toUpperCase()} · {q.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {relatedQuotes.length ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-extrabold uppercase text-[var(--color-text-muted)]">
                Possible matches (by company name)
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {relatedQuotes.map((q) => (
                  <li key={q.id}>
                    <Link className="font-semibold text-sky-800" href={`/enquiries/?q=${encodeURIComponent(q.ref)}&select=${encodeURIComponent(q.id)}`}>
                      {q.ref}
                    </Link>{" "}
                    · {q.mode.toUpperCase()} · {q.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

        </Card>
      ) : null}
    </div>
  );
}
