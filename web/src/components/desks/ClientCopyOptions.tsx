"use client";

import { Lock } from "lucide-react";
import { Input } from "@/components/ui";
import { AGENT_REPLACEMENT_TEXT } from "@/lib/quotes/client-copy";

const RECENT_KEY = "atlas:recent-agents";

function recentAgents(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** Remembers an agent's name on this device so the next quote can pick it with one tap. */
export function rememberAgent(name: string): void {
  const n = name.trim();
  if (!n) return;
  try {
    const next = [n, ...recentAgents().filter((x) => x.toLowerCase() !== n.toLowerCase())].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage can be blocked: the name simply is not remembered */
  }
}

/**
 * The two "client copy" settings on a carrier card (Air desk and Sea desk):
 *  - whether the carrier's name is printed on what the client receives
 *  - Import only: the rate came from an agent, whose name stays inside the company.
 */
export function ClientCopyOptions({
  id,
  carrierWord,
  position,
  hideName,
  onHideName,
  showAgent,
  agentRate,
  agentName,
  onAgent,
  exclude,
  onExclude,
  quoted,
}: {
  id: string;
  /** "airline", "liner" or "coloader" */
  carrierWord: string;
  /** 1-based place of this card on its lane, used for the neutral label. */
  position: number;
  hideName: boolean;
  onHideName: (hide: boolean) => void;
  showAgent: boolean;
  agentRate: boolean;
  agentName: string;
  onAgent: (agentRate: boolean, agentName: string) => void;
  /** Left out of the quote the customer receives. */
  exclude?: boolean;
  onExclude?: (exclude: boolean) => void;
  /** This is the quoted offer: it is always sent, so it cannot be left out. */
  quoted?: boolean;
}) {
  const label = `${carrierWord.charAt(0).toUpperCase()}${carrierWord.slice(1)} option ${position}`;
  const recent = showAgent && agentRate ? recentAgents() : [];
  return (
    <div
      className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3"
      data-testid={`client-copy-${id}`}
    >
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-orange-700">Client copy</div>
      <label className="grid cursor-pointer grid-cols-[20px_1fr] items-start gap-x-2.5">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={!hideName}
          onChange={(e) => onHideName(!e.target.checked)}
          data-testid={`show-name-${id}`}
        />
        <span>
          <span className="block text-sm font-semibold">Show this {carrierWord}&apos;s name on the quote</span>
          <span className="block text-xs text-[var(--color-text-muted)]">
            {hideName
              ? `The client sees “${label}” instead. You still see the real name.`
              : "The client sees the name as you typed it."}
          </span>
        </span>
      </label>

      {onExclude ? (
        <label className="grid cursor-pointer grid-cols-[20px_1fr] items-start gap-x-2.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={!exclude}
            disabled={quoted}
            onChange={(e) => onExclude(!e.target.checked)}
            data-testid={`send-option-${id}`}
          />
          <span>
            <span className="block text-sm font-semibold">Send this option to the customer</span>
            <span className="block text-xs text-[var(--color-text-muted)]">
              {quoted ? "This is the quoted offer, so it is always sent." : exclude ? "Left out: the customer will not see this option. You still see it here." : "Untick to leave this option out of the comparison the customer receives."}
            </span>
          </span>
        </label>
      ) : null}

      {showAgent ? (
        <>
          <label className="grid cursor-pointer grid-cols-[20px_1fr] items-start gap-x-2.5">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={agentRate}
              onChange={(e) => onAgent(e.target.checked, e.target.checked ? agentName : "")}
              data-testid={`agent-rate-${id}`}
            />
            <span>
              <span className="block text-sm font-semibold">Rates procured from an Agent</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                Tick when this rate came from an agent, not the {carrierWord} or a tariff.
              </span>
            </span>
          </label>
          {agentRate ? (
            <div className="ml-7 space-y-1.5 rounded-lg bg-violet-100/70 p-2.5">
              <label htmlFor={`agent-name-${id}`} className="flex items-center gap-1.5 text-xs font-bold text-violet-800">
                <Lock className="h-3.5 w-3.5" aria-hidden /> Agent name · internal only, never on the client quote
              </label>
              <Input
                id={`agent-name-${id}`}
                value={agentName}
                autoComplete="off"
                placeholder="Type the agent’s name"
                onChange={(e) => onAgent(true, e.target.value)}
                onBlur={() => rememberAgent(agentName)}
                data-testid={`agent-name-${id}`}
              />
              {recent.length ? (
                <div className="flex flex-wrap gap-1.5" aria-label="Agents you used before">
                  {recent.map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="rounded-md border border-[var(--color-border-strong)] bg-white px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:border-violet-500 hover:text-violet-700"
                      onClick={() => onAgent(true, a)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-[var(--color-text-muted)]">
                If this name is typed in a note or the terms, the client copy shows “{AGENT_REPLACEMENT_TEXT}” instead.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** "Name on client quote: Show all · Hide all" above the carrier cards. */
export function ShowNamesBar({ onAll }: { onAll: (show: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]" data-testid="show-names-bar">
      <span>Name on client quote:</span>
      <button type="button" className="font-semibold text-[var(--color-brand-blue,#2f6fd6)] underline underline-offset-2" onClick={() => onAll(true)}>
        Show all
      </button>
      <button type="button" className="font-semibold text-[var(--color-brand-blue,#2f6fd6)] underline underline-offset-2" onClick={() => onAll(false)}>
        Hide all
      </button>
    </div>
  );
}
