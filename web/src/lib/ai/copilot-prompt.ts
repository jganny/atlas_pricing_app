import type { GuideEntry } from "@/lib/ai/feature-guide";

/** atlasCopilot rejects messages over 4000 chars; keep headroom. */
export const COPILOT_MAX_MESSAGE = 3800;
export const COPILOT_MAX_QUESTION = 500;

function formatEntry(e: GuideEntry): string {
  return [
    `## ${e.title}`,
    `Where: ${e.where}`,
    e.summary,
    ...e.steps.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");
}

/**
 * Builds the message sent to the atlasCopilot Cloud Function. Contains ONLY the
 * user's question, the screen they're on, and text from the built-in feature
 * guide — never quote, lead, customer or price data. The function's own system
 * prompt already forbids inventing rates; this adds grounding so the model
 * explains the app's real features instead of guessing.
 */
export function buildCopilotMessage(question: string, entries: GuideEntry[], pathname: string): string {
  const q = question.trim().slice(0, COPILOT_MAX_QUESTION);
  const head =
    "You are answering a how-do-I question about the Atlas Pricing web app (test build). " +
    "Answer ONLY from the APP GUIDE below. If the guide does not cover it, say you are not sure and suggest asking an admin — do not invent screens, buttons or features. " +
    "Keep it under 150 words, with short numbered steps where helpful, and name the screen to click.\n\n" +
    `Current screen: ${pathname || "/"}\n` +
    `QUESTION: ${q}\n\n` +
    "--- APP GUIDE ---\n";
  let body = "";
  for (const e of entries) {
    const next = `${body}${body ? "\n\n" : ""}${formatEntry(e)}`;
    if (head.length + next.length > COPILOT_MAX_MESSAGE) break;
    body = next;
  }
  return head + (body || "(no matching guide entries)");
}
