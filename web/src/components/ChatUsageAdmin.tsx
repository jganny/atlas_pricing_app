"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Card } from "@/components/ui";
import { useLiveData } from "@/lib/api";
import { getFirebaseDb } from "@/lib/firebase/client";
import { monthStartKey, summarizeUsage, type UsageRow, type UserUsage } from "@/lib/ai/chat-usage";

const n = (v: number) => v.toLocaleString("en-IN");

/** Admin: who has used Ask Vertex this month, and how much (tokens and web searches are what the AI service bills on). */
export function ChatUsageAdmin() {
  const [data, setData] = useState<{ users: UserUsage[]; total: UserUsage } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!useLiveData) return;
    void getDocs(query(collection(getFirebaseDb(), "chatUsage"), where("day", ">=", monthStartKey())))
      .then((snap) => setData(summarizeUsage(snap.docs.map((d) => d.data() as UsageRow))))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load usage."));
  }, []);

  return (
    <Card className="space-y-2">
      <h2 className="font-bold">Ask Vertex usage this month</h2>
      {!useLiveData ? (
        <p className="text-sm text-[var(--color-text-muted)]">Usage is counted in the live app.</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !data ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : data.users.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No questions asked yet this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-xs">
            <thead className="border-b border-[var(--color-border)] text-[10px] uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="py-1.5">Person</th>
                <th className="py-1.5 text-right">Questions</th>
                <th className="py-1.5 text-right">Days used</th>
                <th className="py-1.5 text-right">Tokens in</th>
                <th className="py-1.5 text-right">Tokens out</th>
                <th className="py-1.5 text-right">Web searches</th>
              </tr>
            </thead>
            <tbody>
              {[...data.users, data.total].map((u, i, all) => (
                <tr key={u.username} className={i === all.length - 1 ? "border-t border-[var(--color-border)] font-bold" : ""}>
                  <td className="py-1.5">{u.username}</td>
                  <td className="py-1.5 text-right tabular-nums">{n(u.questions)}</td>
                  <td className="py-1.5 text-right tabular-nums">{i === all.length - 1 ? "" : n(u.daysActive)}</td>
                  <td className="py-1.5 text-right tabular-nums">{n(u.inTokens)}</td>
                  <td className="py-1.5 text-right tabular-nums">{n(u.outTokens)}</td>
                  <td className="py-1.5 text-right tabular-nums">{n(u.webSearches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            Cost = tokens and web searches × your AI plan&apos;s prices (see your Anthropic console). Each person has a daily limit of 50 questions.
          </p>
        </div>
      )}
    </Card>
  );
}
