"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Loader2, Plus } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useEnquiries, useLeads } from "@/hooks/use-atlas-data";
import { queryKeys } from "@/hooks/query-keys";
import { useAuthStore } from "@/store/auth";
import { useLiveData } from "@/lib/api";
import {
  addLeadActivity,
  fetchLeadActivities,
  saveLead,
  updateLeadStatus,
} from "@/lib/firebase/sales";
import { mockApi } from "@/lib/mock/api";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import {
  LEAD_SOURCES,
  deskHrefForLead,
  isFollowUpDue,
  quotesForCompany,
  stashLeadDeskPrefill,
} from "@/lib/sales/quote-from-lead";
import type { LeadActivity, LeadStatus, SalesLead } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

const STAGES: LeadStatus[] = ["new", "contacted", "qualified", "quoted", "won", "lost"];

const EMPTY_FORM = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  source: "",
  mode: "air" as SalesLead["mode"],
  lane: "",
  dealValue: 0,
  nextAction: "",
  nextDueDate: "",
  owner: "",
  winLossReason: "",
};

export default function SalesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: leads = [], isLoading } = useLeads();
  const { data: enquiries = [] } = useEnquiries();
  const [view, setView] = useState<"list" | "board">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<LeadActivity["type"]>("note");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const relatedQuotes = useMemo(
    () => quotesForCompany(enquiries, selected?.company),
    [enquiries, selected?.company],
  );

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${lead.company} ${lead.contactName || ""} ${lead.lane || ""} ${lead.owner || ""} ${lead.mode || ""}`.toLowerCase();
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
    try {
      if (useLiveData) {
        const rows = await Promise.race([
          fetchLeadActivities(lead.id),
          new Promise<LeadActivity[]>((resolve) => setTimeout(() => resolve([]), 4000)),
        ]);
        if (rows.length) setActivities(rows);
        else setActivities(await mockApi.fetchLeadActivities(lead.id));
      } else {
        setActivities(await mockApi.fetchLeadActivities(lead.id));
      }
    } catch {
      setActivities(await mockApi.fetchLeadActivities(lead.id));
    }
  }

  async function moveLead(id: string, status: LeadStatus) {
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
        leads.map((l) =>
          l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l,
        ),
      );
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
        mode: form.mode,
        lane: form.lane,
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
      queryClient.setQueryData(queryKeys.leads, [row, ...leads]);
      setCreating(false);
      setForm({ ...EMPTY_FORM, owner: user?.username || "" });
      toast("Lead created", "success");
    } finally {
      setBusy(false);
    }
  }

  async function postNote() {
    if (!selected || !note.trim()) return;
    setBusy(true);
    try {
      const body = note.trim();
      if (useLiveData) {
        try {
          await Promise.race([
            addLeadActivity(selected.id, body, user?.username || "desk", noteType),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
          ]);
        } catch {
          /* local */
        }
      }
      setActivities((a) => [
        {
          id: `act-${Date.now()}`,
          leadId: selected.id,
          type: noteType,
          body,
          createdBy: user?.username,
          createdAt: new Date().toISOString(),
        },
        ...a,
      ]);
      setNote("");
      toast("Activity logged", "success");
    } finally {
      setBusy(false);
    }
  }

  function quoteFromLead(lead: SalesLead) {
    stashLeadDeskPrefill(lead);
    const href = deskHrefForLead(lead);
    router.push(lead.mode === "air" || lead.mode === "sea" || !lead.mode ? `${href}${href.includes("?") ? "&" : "?"}smart=1` : href);
  }

  const owners = Object.keys(TEAM_ROLES).filter((k) => k !== "ganny");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[var(--color-atlas-sky)]" />
            <h1 className="text-xl font-extrabold text-[var(--color-atlas-navy)]">Sales</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Pipeline, follow-ups, and quote from lead — same records as legacy Sales.
          </p>
        </div>
        <Button type="button" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New lead
        </Button>
      </div>

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
            <div>
              <Label>Mode</Label>
              <Select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as SalesLead["mode"] }))}
              >
                <option value="air">Air</option>
                <option value="sea">Sea</option>
                <option value="courier">Courier</option>
                <option value="transport">Transport</option>
                <option value="warehouse">Warehouse</option>
              </Select>
            </div>
            <div>
              <Label>Lane</Label>
              <Input
                placeholder="LHR → BLR"
                value={form.lane}
                onChange={(e) => setForm((f) => ({ ...f, lane: e.target.value }))}
              />
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
          placeholder="Search company, contact, lane, owner…"
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
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
              <tr>
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
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
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
                    <td className="px-3 py-2 font-semibold">{lead.company}</td>
                    <td className="px-3 py-2">{lead.contactName || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={lead.status === "won" ? "success" : lead.status === "lost" ? "neutral" : "warn"}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {[lead.lane, lead.mode?.toUpperCase()].filter(Boolean).join(" · ") || "—"}
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
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{status}</span>
                  <Badge tone="neutral">{col.length}</Badge>
                </div>
                <div className="space-y-2">
                  {col.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
                      onClick={() => void openLead(lead)}
                      className={cn(
                        "w-full rounded-lg border bg-white p-2.5 text-left text-sm shadow-sm",
                        selectedId === lead.id
                          ? "border-[var(--color-atlas-sky)] ring-2 ring-sky-100"
                          : "border-[var(--color-border)]",
                      )}
                    >
                      <div className="font-bold text-[var(--color-atlas-navy)]">{lead.company}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {lead.contactName || "—"} · {lead.mode || "—"}
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

      {selected ? (
        <Card>
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
                {selected.lane || "No lane"} · {selected.mode || "—"} ·{" "}
                {selected.dealValue ? formatCurrency(selected.dealValue, "INR") : "no value"}
              </p>
              {selected.nextAction ? (
                <p className="mt-1 text-sm">
                  Next: {selected.nextAction}
                  {selected.nextDueDate ? ` · ${selected.nextDueDate}` : ""}
                </p>
              ) : null}
              {selected.winLossReason ? (
                <p className="mt-1 text-sm text-slate-600">Win/loss: {selected.winLossReason}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                className="w-36"
                value={selected.status}
                onChange={(e) => void moveLead(selected.id, e.target.value as LeadStatus)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" onClick={() => quoteFromLead(selected)}>
                Quote from lead
              </Button>
            </div>
          </div>

          {relatedQuotes.length ? (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-extrabold uppercase text-[var(--color-text-muted)]">Quote history</p>
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

          <h3 className="mt-4 text-sm font-bold">Activity</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Select
              className="w-28"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as LeadActivity["type"])}
            >
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </Select>
            <Input
              className="mt-0 min-w-[12rem] flex-1"
              placeholder="Log a call, meeting, or follow-up…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="button" disabled={busy || !note.trim()} onClick={() => void postNote()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}
            </Button>
          </div>
          {(selected.status === "won" || selected.status === "lost") && !selected.winLossReason ? (
            <p className="mt-2 text-xs text-amber-800">Add a win/loss reason when you edit this lead in Firestore or recreate it.</p>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm">
            {activities.length === 0 ? (
              <li className="text-[var(--color-text-muted)]">No activities yet.</li>
            ) : (
              activities.map((a) => (
                <li key={a.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{a.type}</Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {a.createdBy} · {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1">{a.body}</div>
                </li>
              ))
            )}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
