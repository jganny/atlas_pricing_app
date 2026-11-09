import assert from "node:assert/strict";
import {
  DEFAULT_QUESTIONS,
  applyConfig,
  configFromQuestions,
  hasAnyAnswer,
  isKnownOption,
  optionAnswer,
  plusDays,
  questionsFor,
  reportSummary,
  reportToActivity,
  suggestionId,
  typedAnswers,
  visitHistory,
} from "./visit-report";

// --- first visit asks 7 questions, a follow-up asks 4 ---
assert.deepEqual(questionsFor("first").map((q) => q.id), ["who", "purpose", "commodity", "industry", "scope", "next", "outcome"]);
assert.deepEqual(questionsFor("follow").map((q) => q.id), ["purpose", "scope", "next", "outcome"]);

// --- the options asked for: payment collection, and sea import / export in both FCL and LCL ---
const purpose = DEFAULT_QUESTIONS.find((q) => q.id === "purpose")!;
assert.ok(purpose.options.some((o) => o.label === "Payment collection"));
const scope = DEFAULT_QUESTIONS.find((q) => q.id === "scope")!;
assert.deepEqual(scope.options.filter((o) => o.group === "Sea").map(optionAnswer), ["Sea Export FCL", "Sea Export LCL", "Sea Import FCL", "Sea Import LCL"]);
assert.deepEqual(scope.options.filter((o) => o.group === "Air").map(optionAnswer), ["Air Export", "Air Import"]);
assert.equal(optionAnswer({ label: "Courier", group: "Other services" }), "Courier");

// --- admin edits: added, renamed, hidden options; hidden ones are not asked ---
{
  const questions = DEFAULT_QUESTIONS.map((q) => (q.id === "purpose" ? { ...q, options: [...q.options.map((o) => (o.label === "Collect documents" ? { ...o, hidden: true } : o)), { label: "Site visit" }] } : q));
  const saved = configFromQuestions(questions);
  assert.ok(!("who" in saved), "a free-text question has nothing to save");
  const asked = questionsFor("first", saved).find((q) => q.id === "purpose")!;
  assert.ok(asked.options.some((o) => o.label === "Site visit"));
  assert.ok(!asked.options.some((o) => o.label === "Collect documents"), "a hidden option is not asked");
  assert.ok(applyConfig(saved).find((q) => q.id === "purpose")!.options.some((o) => o.label === "Collect documents" && o.hidden), "but it is kept for the admin to show again");
  // a bad saved config falls back to the defaults
  assert.deepEqual(applyConfig({ purpose: { options: "x" as never, allowOther: true } }).find((q) => q.id === "purpose")!.options, purpose.options);
  assert.deepEqual(applyConfig(null).map((q) => q.id), DEFAULT_QUESTIONS.map((q) => q.id));
  // blank names are dropped
  assert.equal(applyConfig({ commodity: { options: [{ label: "  " }, { label: "Solar" }], allowOther: false } }).find((q) => q.id === "commodity")!.options.length, 1);
  assert.equal(questionsFor("first", { commodity: { options: [{ label: "Solar" }], allowOther: false } }).find((q) => q.id === "commodity")!.allowOther, false);
}

// --- first visit or follow-up comes from the earlier meetings ---
{
  assert.deepEqual(visitHistory([]), { kind: "first", visitNo: 1 });
  assert.equal(visitHistory([{ type: "call", createdAt: "2026-11-01T10:00:00Z" }, { type: "note", createdAt: "2026-11-02T10:00:00Z" }]).kind, "first", "calls and notes are not visits");
  const h = visitHistory([
    { type: "meeting", createdAt: "2026-10-01T10:00:00Z", activityDate: "2026-10-01", nextStep: "Send rates", followUpDate: "2026-10-05" },
    { type: "meeting", createdAt: "2026-10-20T10:00:00Z", activityDate: "2026-10-20", nextStep: "Send Frankfurt rates", followUpDate: "2026-10-25" },
  ]);
  assert.equal(h.kind, "follow");
  assert.equal(h.visitNo, 3);
  assert.deepEqual(h.lastPlan, { day: "2026-10-20", next: "Send Frankfurt rates", by: "2026-10-25" }, "the latest plan, not the first");
  assert.equal(visitHistory([{ type: "meeting", createdAt: "2026-10-01T10:00:00Z" }]).lastPlan, undefined);
}

// --- the answers become a note, a next step with its date, and a structured report ---
{
  const a = {
    who: "Ravi Kumar, Logistics Manager",
    purpose: "Payment collection",
    commodity: ["Electronics", "Machinery"],
    industry: ["Retail"],
    scope: ["Sea Export FCL", "Air Import"],
    scopeNote: "asked 40HC rates, with a competitor",
    next: { what: "Send quote", when: "2026-11-12" },
    outcome: "Warm",
  };
  const r = reportToActivity("first", 1, a);
  assert.match(r.body, /^First visit\./);
  assert.match(r.body, /Met Ravi Kumar, Logistics Manager\./);
  assert.match(r.body, /Purpose: Payment collection\./);
  assert.match(r.body, /Discussed: Sea Export FCL, Air Import\./);
  assert.match(r.body, /Detail: asked 40HC rates, with a competitor\./);
  assert.equal(r.nextStep, "Send quote");
  assert.equal(r.followUpDate, "2026-11-12");
  assert.deepEqual(r.report.scope, ["Sea Export FCL", "Air Import"]);
  assert.equal(r.report.outcome, "Warm");
  assert.equal(r.report.visitNo, 1);
}

// --- skipped questions leave no trace; a report of only skips is not saved ---
{
  const a = { who: null, purpose: "Introduction", commodity: null, industry: [], scope: null, next: null, outcome: null };
  const r = reportToActivity("follow", 2, a);
  assert.equal(r.body, "Follow-up visit 2. Purpose: Introduction.");
  assert.ok(!("nextStep" in r) && !("followUpDate" in r));
  assert.deepEqual(r.report, { kind: "follow", visitNo: 2, purpose: "Introduction" });
  assert.equal(hasAnyAnswer({ who: null, purpose: null, commodity: null, scope: null, next: null, outcome: null }), false);
  assert.equal(hasAnyAnswer({ purpose: "  " }), false);
  assert.equal(hasAnyAnswer({ outcome: "Cold" }), true);
  assert.equal(hasAnyAnswer({ next: { what: "Call back", when: "" } }), true);
  // a next step with no date still saves the step
  const n = reportToActivity("first", 1, { next: { what: "Call back", when: "" } });
  assert.equal(n.nextStep, "Call back");
  assert.ok(!("followUpDate" in n));
}

// --- last time's plan shows in the note ---
assert.match(reportSummary("follow", 2, { lastPlanDone: "no", purpose: "Service review" }), /Last time's plan: not yet done\./);
assert.match(reportSummary("follow", 2, { lastPlanDone: "yes" }), /Last time's plan: done\./);

// --- dates ---
assert.equal(plusDays(3, new Date(2026, 10, 10)), "2026-11-13");
assert.equal(plusDays(14, new Date(2026, 11, 25)), "2027-01-08", "across a year end");

// --- "something else": only genuinely new typed words are offered ---
{
  const qs = questionsFor("first");
  const t = typedAnswers(qs, { purpose: "Document pickup", commodity: ["Electronics", "Solar panels"], scope: ["Sea Export FCL", "Customs audit"], next: { what: "Send quote", when: "" }, industry: [] });
  assert.deepEqual(t, [
    { question: "purpose", text: "Document pickup" },
    { question: "commodity", text: "Solar panels" },
    { question: "scope", text: "Customs audit" },
  ]);
  assert.equal(isKnownOption(qs.find((q) => q.id === "scope")!, "export fcl"), true);
  assert.equal(isKnownOption(qs.find((q) => q.id === "scope")!, "Sea Export FCL"), true);
  const noOther = questionsFor("first", { purpose: { options: purpose.options, allowOther: false } });
  assert.deepEqual(typedAnswers(noOther, { purpose: "Document pickup" }), [], "a question that does not allow other answers collects none");
  assert.equal(suggestionId("scope", "Customs audit!"), suggestionId("scope", "  customs   AUDIT "), "the same words are the same suggestion");
  assert.notEqual(suggestionId("scope", "Customs audit"), suggestionId("purpose", "Customs audit"));
}

console.log("visit report ok");
