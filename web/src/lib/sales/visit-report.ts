/**
 * Visit report: a short guided conversation instead of one blank box.
 *
 * The app knows whether this is the first visit to a company or a follow-up and asks 7 or 4 questions, each with tap-to-pick
 * options (typing and the microphone always work) and each can be skipped. The answers become a readable note (so the older
 * app and every list still show something sensible) plus a structured `report` kept on the visit for managers to filter.
 * The option lists are edited by the admin; what people type under "something else" comes back as suggestions.
 */
import type { LeadActivity } from "@/lib/types";
import { todayISO } from "./activity-log";

export type VisitQuestionId = "who" | "purpose" | "commodity" | "industry" | "scope" | "next" | "outcome";
export type VisitKind = "first" | "follow";

export interface VisitOption {
  label: string;
  hidden?: boolean;
  /** Scope options are grouped (Air, Sea, Other services). */
  group?: string;
}

export interface VisitQuestion {
  id: VisitQuestionId;
  /** The name in the report and in the admin list. */
  name: string;
  /** The question as the person is asked it. */
  ask: string;
  hint?: string;
  type: "text" | "single" | "multi" | "next";
  placeholder?: string;
  options: VisitOption[];
  /** People may type their own answer ("something else"). */
  allowOther: boolean;
  /** The question also takes a free-text detail next to the chosen options. */
  detail?: boolean;
  grouped?: boolean;
  /** "first" = only asked on the first visit; "both" = first visit and follow-ups. */
  asked: "first" | "both";
}

const opts = (labels: string[], group?: string): VisitOption[] => labels.map((label) => ({ label, ...(group ? { group } : {}) }));

export const DEFAULT_QUESTIONS: VisitQuestion[] = [
  { id: "who", name: "Who you met", ask: "Who did you meet?", type: "text", placeholder: "Name and designation, e.g. Ravi Kumar, Logistics Manager", options: [], allowOther: false, asked: "first" },
  {
    id: "purpose",
    name: "Purpose of visit",
    ask: "What was the purpose of the visit?",
    type: "single",
    options: opts(["Introduction", "Rates / quotation", "Service review", "Issue / complaint", "Renewal / contract", "Payment collection", "Collect documents"]),
    allowOther: true,
    asked: "both",
  },
  {
    id: "commodity",
    name: "Commodity / product",
    ask: "What do they ship?",
    hint: "Pick all that apply.",
    type: "multi",
    options: opts(["Electronics", "Garments / textiles", "Pharma / healthcare", "Auto parts", "Machinery", "Food / perishables", "Chemicals", "Handicrafts"]),
    allowOther: true,
    asked: "first",
  },
  {
    id: "industry",
    name: "Industries they served",
    ask: "Which industries do they serve?",
    hint: "Pick all that apply.",
    type: "multi",
    options: opts(["Retail", "Manufacturing", "Healthcare", "Automotive", "IT / electronics", "FMCG", "Engineering", "Export house"]),
    allowOther: true,
    asked: "first",
  },
  {
    id: "scope",
    name: "Scope of discussion",
    ask: "What did you discuss?",
    hint: "Pick all that apply, then add any detail: rates asked, volumes, competitor, objections.",
    type: "multi",
    options: [
      ...opts(["Export", "Import"], "Air"),
      ...opts(["Export FCL", "Export LCL", "Import FCL", "Import LCL"], "Sea"),
      ...opts(["Courier", "Transport", "Warehousing", "Customs", "Project cargo"], "Other services"),
    ],
    allowOther: true,
    detail: true,
    grouped: true,
    asked: "both",
  },
  {
    id: "next",
    name: "Next action / follow-up plan",
    ask: "What happens next?",
    type: "next",
    options: opts(["Send quote", "Send rate sheet", "Arrange another meeting", "Share documents", "Trial shipment", "Call back"]),
    allowOther: true,
    asked: "both",
  },
  {
    id: "outcome",
    name: "How it went",
    ask: "How did it go?",
    hint: "One tap. It helps your manager read the pipeline.",
    type: "single",
    options: opts(["Warm", "Neutral", "Cold"]),
    allowOther: false,
    asked: "both",
  },
];

/** The part of the questions an admin can change and that is saved: the options and whether "something else" is allowed. */
export type VisitConfig = Partial<Record<VisitQuestionId, { options: VisitOption[]; allowOther: boolean }>>;

const cleanOption = (o: VisitOption): VisitOption => ({
  label: String(o.label ?? "").trim(),
  ...(o.hidden ? { hidden: true } : {}),
  ...(o.group ? { group: String(o.group) } : {}),
});

/** The defaults with the admin's saved options laid over them. Anything missing or malformed falls back to the default. */
export function applyConfig(config?: VisitConfig | null): VisitQuestion[] {
  return DEFAULT_QUESTIONS.map((q) => {
    const saved = config?.[q.id];
    if (!saved || !Array.isArray(saved.options) || q.type === "text") return q;
    const options = saved.options.map(cleanOption).filter((o) => o.label);
    return { ...q, options, allowOther: typeof saved.allowOther === "boolean" ? saved.allowOther : q.allowOther };
  });
}

/** What is saved from the admin's edits: only the questions that have options to edit. */
export function configFromQuestions(questions: VisitQuestion[]): VisitConfig {
  const out: VisitConfig = {};
  for (const q of questions) {
    if (q.type === "text") continue;
    out[q.id] = { options: q.options.map(cleanOption).filter((o) => o.label), allowOther: q.allowOther };
  }
  return out;
}

/** The questions to ask, in order, for a first visit or a follow-up. Hidden options are left out. */
export function questionsFor(kind: VisitKind, config?: VisitConfig | null): VisitQuestion[] {
  return applyConfig(config)
    .filter((q) => kind === "first" || q.asked === "both")
    .map((q) => ({ ...q, options: q.options.filter((o) => !o.hidden) }));
}

/** An option as it reads in an answer: "Sea" + "Export FCL" -> "Sea Export FCL". Other groups keep their own name. */
export function optionAnswer(o: VisitOption): string {
  return o.group === "Air" || o.group === "Sea" ? `${o.group} ${o.label}` : o.label;
}

// --- what the person answered ---------------------------------------------------------------------------------

export interface NextAnswer {
  what: string;
  /** YYYY-MM-DD */
  when: string;
}

/** null = the question was skipped; undefined = not reached yet. */
export interface VisitAnswers {
  who?: string | null;
  purpose?: string | null;
  commodity?: string[] | null;
  industry?: string[] | null;
  scope?: string[] | null;
  scopeNote?: string;
  next?: NextAnswer | null;
  outcome?: string | null;
  /** Follow-ups only: did what was planned last time happen? */
  lastPlanDone?: "yes" | "no";
}

/** The structured part kept on the visit. Only what was answered is stored. */
export interface VisitReport {
  kind: VisitKind;
  visitNo: number;
  who?: string;
  purpose?: string;
  commodity?: string[];
  industry?: string[];
  scope?: string[];
  scopeNote?: string;
  outcome?: string;
  lastPlanDone?: "yes" | "no";
}

export const NEXT_WHEN_CHOICES: Array<{ label: string; days: number }> = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

/** A date `days` after `from` (YYYY-MM-DD, in the person's own calendar). */
export function plusDays(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return todayISO(d);
}

const filled = (v: string | null | undefined): v is string => typeof v === "string" && v.trim() !== "";
const list = (v: string[] | null | undefined): string[] => (Array.isArray(v) ? v.map((x) => x.trim()).filter(Boolean) : []);

/** Has the person given at least one real answer? A report of nothing but skips is not worth saving. */
export function hasAnyAnswer(a: VisitAnswers): boolean {
  return filled(a.who) || filled(a.purpose) || list(a.commodity).length > 0 || list(a.industry).length > 0 || list(a.scope).length > 0 || filled(a.scopeNote) || !!(a.next && filled(a.next.what)) || filled(a.outcome);
}

/** The one-paragraph summary: this is the visit's note, so every list (and the older app) reads it as plain text. */
export function reportSummary(kind: VisitKind, visitNo: number, a: VisitAnswers): string {
  const parts: string[] = [kind === "first" ? "First visit." : `Follow-up visit ${visitNo}.`];
  if (a.lastPlanDone) parts.push(`Last time's plan: ${a.lastPlanDone === "yes" ? "done" : "not yet done"}.`);
  if (filled(a.who)) parts.push(`Met ${a.who!.trim()}.`);
  if (filled(a.purpose)) parts.push(`Purpose: ${a.purpose!.trim()}.`);
  if (list(a.commodity).length) parts.push(`Ships: ${list(a.commodity).join(", ")}.`);
  if (list(a.industry).length) parts.push(`Industries served: ${list(a.industry).join(", ")}.`);
  if (list(a.scope).length) parts.push(`Discussed: ${list(a.scope).join(", ")}.`);
  if (filled(a.scopeNote)) parts.push(`Detail: ${a.scopeNote!.trim()}.`);
  if (filled(a.outcome)) parts.push(`How it went: ${a.outcome!.trim()}.`);
  return parts.join(" ");
}

/** The fields to save on the visit (type "meeting"): the readable note, the next step and date, and the structured report. */
export function reportToActivity(
  kind: VisitKind,
  visitNo: number,
  a: VisitAnswers,
): { body: string; nextStep?: string; followUpDate?: string; report: VisitReport } {
  const report: VisitReport = {
    kind,
    visitNo,
    ...(filled(a.who) ? { who: a.who!.trim() } : {}),
    ...(filled(a.purpose) ? { purpose: a.purpose!.trim() } : {}),
    ...(list(a.commodity).length ? { commodity: list(a.commodity) } : {}),
    ...(list(a.industry).length ? { industry: list(a.industry) } : {}),
    ...(list(a.scope).length ? { scope: list(a.scope) } : {}),
    ...(filled(a.scopeNote) ? { scopeNote: a.scopeNote!.trim() } : {}),
    ...(filled(a.outcome) ? { outcome: a.outcome!.trim() } : {}),
    ...(a.lastPlanDone ? { lastPlanDone: a.lastPlanDone } : {}),
  };
  return {
    body: reportSummary(kind, visitNo, a),
    ...(a.next && filled(a.next.what) ? { nextStep: a.next.what.trim() } : {}),
    ...(a.next && filled(a.next.what) && a.next.when ? { followUpDate: a.next.when } : {}),
    report,
  };
}

// --- first visit or follow-up ----------------------------------------------------------------------------------

export interface VisitHistory {
  kind: VisitKind;
  /** This visit's number: 1 for the first. */
  visitNo: number;
  /** What was planned at the last visit, if anything. */
  lastPlan?: { day: string; next: string; by?: string };
}

/** The company's earlier visits (meetings) decide the question set. Calls, emails and notes do not count as visits. */
export function visitHistory(activities: Array<Pick<LeadActivity, "type" | "activityDate" | "createdAt" | "nextStep" | "followUpDate">>): VisitHistory {
  const meetings = activities
    .filter((a) => a.type === "meeting")
    .sort((a, b) => (b.activityDate || b.createdAt).localeCompare(a.activityDate || a.createdAt));
  if (!meetings.length) return { kind: "first", visitNo: 1 };
  const last = meetings.find((m) => (m.nextStep || "").trim());
  return {
    kind: "follow",
    visitNo: meetings.length + 1,
    ...(last ? { lastPlan: { day: (last.activityDate || last.createdAt).slice(0, 10), next: String(last.nextStep).trim(), ...(last.followUpDate ? { by: last.followUpDate } : {}) } } : {}),
  };
}

// --- "something else" suggestions ------------------------------------------------------------------------------

export interface VisitSuggestion {
  id: string;
  question: VisitQuestionId;
  text: string;
  count: number;
  by: string[];
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Is this text already one of the question's options? Then it is not a suggestion. */
export function isKnownOption(question: VisitQuestion, text: string): boolean {
  return question.options.some((o) => sameText(o.label, text) || sameText(optionAnswer(o), text));
}

/** Stable id for a suggestion: the same words for the same question always land on the same record. */
export function suggestionId(question: VisitQuestionId, text: string): string {
  return `${question}__${text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
}

/** The typed "something else" answers of one finished report that should be offered to the admin. */
export function typedAnswers(questions: VisitQuestion[], a: VisitAnswers): Array<{ question: VisitQuestionId; text: string }> {
  const out: Array<{ question: VisitQuestionId; text: string }> = [];
  const add = (q: VisitQuestion | undefined, text: string | undefined | null) => {
    const t = (text || "").trim();
    if (q && q.allowOther && t && !isKnownOption(q, t) && t.length <= 60) out.push({ question: q.id, text: t });
  };
  const by = (id: VisitQuestionId) => questions.find((q) => q.id === id);
  add(by("purpose"), a.purpose);
  for (const c of list(a.commodity)) add(by("commodity"), c);
  for (const c of list(a.industry)) add(by("industry"), c);
  for (const c of list(a.scope)) add(by("scope"), c);
  add(by("next"), a.next?.what);
  return out;
}
