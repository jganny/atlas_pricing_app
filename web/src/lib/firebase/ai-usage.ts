"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./client";
import type { AiSummaryView } from "@/lib/ai/ai-usage-view";

const call = <I, O>(name: string) => httpsCallable<I, O>(getFunctions(getFirebaseApp()), name);

/** Admin only (the server checks): last three months of AI use and cost, the credit status, the estimated balance. */
export async function getAiUsageSummary(): Promise<AiSummaryView> {
  return (await call<unknown, AiSummaryView>("aiUsageSummary")({})).data;
}

/** Admin only: what the Anthropic Console shows right now. The app counts down from it and warns below `lowAtUsd`. */
export async function saveAiBilling(input: { balanceUsd: number; lowAtUsd: number; inrPerUsd: number }): Promise<void> {
  await call<typeof input, { ok: boolean }>("aiBillingSave")(input);
}

/** Admin only: monthly budgets. Empty means no limit; 0 pauses a feature. The server refuses AI calls once a budget is reached. */
export async function saveAiBudgets(input: { totalUsd: number | null; perFeature: Record<string, number> }): Promise<void> {
  await call<typeof input, { ok: boolean }>("aiBudgetsSave")(input);
}
