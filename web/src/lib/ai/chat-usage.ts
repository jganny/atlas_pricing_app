/** Ask Vertex usage for the admin: questions, tokens and web searches per person for a month. */

export interface UsageRow {
  username?: string;
  day?: string;
  count?: number;
  inTokens?: number;
  outTokens?: number;
  webSearches?: number;
}

export interface UserUsage {
  username: string;
  questions: number;
  inTokens: number;
  outTokens: number;
  webSearches: number;
  daysActive: number;
}

export function monthStartKey(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return `${ist.getUTCFullYear()}${String(ist.getUTCMonth() + 1).padStart(2, "0")}01`;
}

export function summarizeUsage(rows: UsageRow[]): { users: UserUsage[]; total: UserUsage } {
  const by = new Map<string, UserUsage>();
  for (const r of rows) {
    const name = (r.username || "unknown").toLowerCase();
    const u = by.get(name) ?? { username: name, questions: 0, inTokens: 0, outTokens: 0, webSearches: 0, daysActive: 0 };
    u.questions += Number(r.count) || 0;
    u.inTokens += Number(r.inTokens) || 0;
    u.outTokens += Number(r.outTokens) || 0;
    u.webSearches += Number(r.webSearches) || 0;
    u.daysActive += 1;
    by.set(name, u);
  }
  const users = [...by.values()].sort((a, b) => b.questions - a.questions);
  const total = users.reduce(
    (t, u) => ({ ...t, questions: t.questions + u.questions, inTokens: t.inTokens + u.inTokens, outTokens: t.outTokens + u.outTokens, webSearches: t.webSearches + u.webSearches, daysActive: t.daysActive + u.daysActive }),
    { username: "All", questions: 0, inTokens: 0, outTokens: 0, webSearches: 0, daysActive: 0 },
  );
  return { users, total };
}
