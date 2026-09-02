"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ExternalLink,
  MinusCircle,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  MIGRATION_POLICY,
  parityGroups,
  parityStats,
  plannedPhases,
  type ParityStatus,
} from "@/lib/migration/parity-features";

const statusConfig: Record<
  ParityStatus,
  { label: string; tone: "success" | "warn" | "neutral"; icon: typeof CheckCircle2 }
> = {
  done: { label: "Done in React", tone: "success", icon: CheckCircle2 },
  partial: { label: "Partial", tone: "warn", icon: MinusCircle },
  missing: { label: "Not in React yet", tone: "neutral", icon: CircleDashed },
};

export default function FeatureParityPage() {
  const stats = useMemo(() => parityStats(), []);
  const [filter, setFilter] = useState<ParityStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(parityGroups[0]?.id ?? null);

  const filteredGroups = useMemo(() => {
    if (filter === "all") return parityGroups;
    return parityGroups
      .map((g) => ({ ...g, features: g.features.filter((f) => f.status === filter) }))
      .filter((g) => g.features.length > 0);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-violet-600">
          <ClipboardCheck className="h-5 w-5" />
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
            Feature parity tracker
          </h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
          {MIGRATION_POLICY.summary}
        </p>
      </div>

      <Card className="border-violet-200 bg-gradient-to-br from-violet-50/80 to-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
              {MIGRATION_POLICY.headline}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
              {stats.done} of {stats.total} features complete ({stats.percent}%)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="success">{stats.done} done</Badge>
              <Badge tone="warn">{stats.partial} partial</Badge>
              <Badge tone="neutral">{stats.missing} missing</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={MIGRATION_POLICY.legacyUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Open legacy (production)
              <ExternalLink className="h-4 w-4" />
            </a>
            <Button type="button" variant="secondary" onClick={() => setFilter("missing")}>
              Show gaps only
            </Button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-[var(--color-atlas-navy)]">How you approve migration</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--color-text-muted)]">
          <li>We build each missing feature in React (Phases 6–14 below).</li>
          <li>You test the same workflow in legacy and in React — use the test hints on each row.</li>
          <li>When every row is <strong className="text-emerald-700">Done</strong> and React feels equal or better, you say <strong>“Approve migration.”</strong></li>
          <li>Only then do we switch the default homepage from legacy to <code className="rounded bg-slate-100 px-1">/app/</code>.</li>
        </ol>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["all", "done", "partial", "missing"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
              filter === key
                ? "bg-[var(--color-atlas-navy)] text-white"
                : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-slate-50"
            }`}
          >
            {key === "all" ? "All features" : key}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const gStats = parityStats([group]);
          const isOpen = expanded === group.id;
          return (
            <Card key={group.id} className="overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/80"
                onClick={() => setExpanded(isOpen ? null : group.id)}
              >
                <div>
                  <h2 className="font-bold text-[var(--color-atlas-navy)]">{group.title}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{group.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="info">Phase {group.plannedPhase}</Badge>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {gStats.done}/{gStats.total} done
                  </span>
                </div>
              </button>
              {isOpen ? (
                <div className="border-t border-[var(--color-border)]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]">
                      <tr>
                        <th className="px-4 py-2 text-left">Feature</th>
                        <th className="px-4 py-2 text-left">Legacy</th>
                        <th className="px-4 py-2 text-left">React</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.features.map((f) => {
                        const cfg = statusConfig[f.status];
                        const Icon = cfg.icon;
                        return (
                          <tr key={f.id} className="border-t align-top">
                            <td className="px-4 py-3">
                              <div className="font-semibold">{f.name}</div>
                              {f.testHint ? (
                                <div className="mt-1 flex items-start gap-1 text-xs text-[var(--color-text-muted)]">
                                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                  Test: {f.testHint}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-[var(--color-text-muted)]">{f.legacy}</td>
                            <td className="px-4 py-3">
                              {f.react ? (
                                f.react.startsWith("/") ? (
                                  <Link href={f.react} className="font-semibold text-sky-700 hover:underline">
                                    {f.react}
                                  </Link>
                                ) : (
                                  <span className="text-[var(--color-text-muted)]">{f.react}</span>
                                )
                              ) : (
                                <span className="text-[var(--color-text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Icon
                                  className={`h-4 w-4 ${
                                    f.status === "done"
                                      ? "text-emerald-600"
                                      : f.status === "partial"
                                        ? "text-amber-600"
                                        : "text-slate-400"
                                  }`}
                                />
                                <Badge tone={cfg.tone}>{cfg.label}</Badge>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white">
        <h2 className="font-bold text-[var(--color-atlas-navy)]">Premium tech vision (Phases 7–14)</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Every phase ships <strong>legacy parity</strong> plus an <strong>innovation slice</strong> — modern patterns
          from Salesforce, CargoWise, SAP, Microsoft. See <code className="rounded bg-slate-100 px-1">TECH_VISION.md</code> in
          the repo for the full roadmap.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-text-muted)]">
          <li>✅ Live Firestore sync — enquiries update without Refresh</li>
          <li>✅ Command palette — ⌘K / Ctrl+K jump anywhere</li>
          <li>🔜 shadcn/ui data tables, Zod validation, optimistic updates (Phase 7+)</li>
          <li>🔜 AI smart inbox, rate intelligence, audit log (Phase 11+)</li>
        </ul>
      </Card>

      <Card>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Original Phases 0–5 covered the foundation. Remaining legacy features are grouped below.
          Say <strong>“Start Phase 6”</strong> (or any phase) when you want work to begin.
        </p>
        <div className="mt-4 space-y-2">
          {plannedPhases.map((p) => (
            <div
              key={p.phase}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-[var(--color-border)] px-4 py-3"
            >
              <Badge tone="info">Phase {p.phase}</Badge>
              <span className="font-bold text-[var(--color-atlas-navy)]">{p.title}</span>
              <span className="text-sm text-[var(--color-text-muted)]">— {p.items}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
