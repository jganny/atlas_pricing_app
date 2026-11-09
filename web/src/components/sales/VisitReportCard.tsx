"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { VisitChat } from "@/components/sales/VisitChat";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import { logAudit } from "@/lib/firebase/audit-log";
import { addLeadActivity, fetchLeadActivities } from "@/lib/firebase/sales";
import { addVisitSuggestions, fetchVisitConfig } from "@/lib/firebase/visit-options";
import { mockApi } from "@/lib/mock/api";
import { todayISO } from "@/lib/sales/activity-log";
import { questionsFor, reportToActivity, typedAnswers, visitHistory, type VisitAnswers, type VisitConfig } from "@/lib/sales/visit-report";
import type { LeadActivity } from "@/lib/types";

/**
 * "Log a visit" for one company: loads the company's earlier visits (to know first visit or follow-up) and the admin's option
 * lists, runs the guided conversation, and saves the answers as a visit (meeting) with its next step, reminder date and report.
 */
export function VisitReportCard({
  leadId,
  company,
  username,
  onSaved,
  onCancel,
}: {
  leadId: string;
  company: string;
  username: string;
  /** Called with the saved visit so the page can show it straight away. */
  onSaved: (activity: LeadActivity) => void;
  onCancel: () => void;
}) {
  const [activities, setActivities] = useState<LeadActivity[] | null>(null);
  const [config, setConfig] = useState<VisitConfig | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let rows: LeadActivity[] = [];
      try {
        if (useLiveData) {
          rows = await Promise.race([fetchLeadActivities(leadId), new Promise<LeadActivity[]>((r) => setTimeout(() => r([]), 4000))]);
        }
        if (!rows.length) rows = await mockApi.fetchLeadActivities(leadId);
      } catch {
        rows = [];
      }
      const cfg = await fetchVisitConfig();
      if (alive) {
        setActivities(rows);
        setConfig(cfg);
      }
    })();
    return () => {
      alive = false;
    };
  }, [leadId]);

  const history = useMemo(() => visitHistory(activities ?? []), [activities]);
  const questions = useMemo(() => questionsFor(history.kind, config ?? null), [history.kind, config]);

  async function save(answers: VisitAnswers) {
    setBusy(true);
    try {
      const fields = reportToActivity(history.kind, history.visitNo, answers);
      const extra = { activityDate: todayISO(), nextStep: fields.nextStep, followUpDate: fields.followUpDate, report: fields.report };
      if (useLiveData) {
        try {
          await Promise.race([addLeadActivity(leadId, fields.body, username || "desk", "meeting", extra), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
        } catch {
          /* kept locally, like the older visit form */
        }
      }
      // What was typed under "something else" goes to the admin as suggestions. Never blocks saving the visit.
      try {
        await addVisitSuggestions(typedAnswers(questions, answers), username);
      } catch {
        /* suggestions are a courtesy */
      }
      logAudit({ action: "lead.visit", entityType: "lead", entityId: leadId, entityLabel: company, summary: `${history.kind === "first" ? "First visit" : `Follow-up visit ${history.visitNo}`} report` });
      toast(`Visit to ${company} logged`, "success");
      onSaved({ id: `act-${Date.now()}`, leadId, type: "meeting", body: fields.body, createdBy: username, createdAt: new Date().toISOString(), ...extra, ...(extra.nextStep ? {} : { nextStep: undefined }) });
    } finally {
      setBusy(false);
    }
  }

  if (activities === null || config === undefined) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Getting {company}&apos;s earlier visits…
      </p>
    );
  }
  return <VisitChat key={`${leadId}-${history.kind}`} company={company} history={history} questions={questions} busy={busy} onSave={(a) => void save(a)} onCancel={onCancel} />;
}
