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
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  INNOVATION_PRINCIPLE,
  innovationItems,
  innovationStats,
  type InnovationStatus,
} from "@/lib/migration/innovation-tracker";
import {
  MIGRATION_POLICY,
  parityGroups,
  parityStats,
  plannedPhases,
  type ParityStatus,
} from "@/lib/migration/parity-features";

type Tab = "parity" | "innovation";

const parityStatusConfig: Record<
  ParityStatus,
  { label: string; tone: "success" | "warn" | "neutral"; icon: typeof CheckCircle2 }
> = {
  done: { label: "Done in React", tone: "success", icon: CheckCircle2 },
  partial: { label: "Partial", tone: "warn", icon: MinusCircle },
  missing: { label: "Not in React yet", tone: "neutral", icon: CircleDashed },
};

const innovationStatusConfig: Record<
  InnovationStatus,
  { label: string; tone: "success" | "warn" | "neutral" | "info"; icon: typeof CheckCircle2 }
> = {
  done: { label: "Shipped", tone: "success", icon: CheckCircle2 },
  partial: { label: "Partial", tone: "warn", icon: MinusCircle },
  planned: { label: "Planned", tone: "neutral", icon: CircleDashed },
  retrofit: { label: "Retrofit", tone: "info", icon: Wrench },
};

export default function FeatureParityPage() {
  const [tab, setTab] = useState<Tab>("parity");
  const stats = useMemo(() => parityStats(), []);
  const iStats = useMemo(() => innovationStats(), []);
  const [filter, setFilter] = useState<ParityStatus | "all">("all");
  const [iFilter, setIFilter] = useState<InnovationStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(parityGroups[0]?.id ?? null);

  const filteredGroups = useMemo(() => {
    if (filter === "all") return parityGroups;
    return parityGroups
      .map((g) => ({ ...g, features: g.features.filter((f) => f.status === filter) }))
      .filter((g) => g.features.length > 0);
  }, [filter]);

  const filteredInnovation = useMemo(() => {
    if (iFilter === "all") return innovationItems;
    return innovationItems.filter((i) => i.status === iFilter);
  }, [iFilter]);

  const innovationByPhase = useMemo(() => {
    const phases = [...new Set(filteredInnovation.map((i) => i.phase))].sort((a, b) => a - b);
    return phases.map((phase) => ({
      phase,
      items: filteredInnovation.filter((i) => i.phase === phase),
    }));
  }, [filteredInnovation]);

  const parityComplete = stats.done === stats.total && stats.partial === 0 && stats.missing === 0;
  const innovationComplete = iStats.done === iStats.total;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-violet-600">
          <ClipboardCheck className="h-5 w-5" />
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
            Migration trackers
          </h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
          {tab === "parity" ? MIGRATION_POLICY.summary : INNOVATION_PRINCIPLE}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        <button
          type="button"
          onClick={() => setTab("parity")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            tab === "parity"
              ? "bg-[var(--color-atlas-navy)] text-white"
              : "text-[var(--color-text-muted)] hover:bg-slate-100"
          }`}
        >
          Legacy parity ({stats.percent}%)
        </button>
        <button
          type="button"
          onClick={() => setTab("innovation")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
            tab === "innovation"
              ? "bg-violet-700 text-white"
              : "text-[var(--color-text-muted)] hover:bg-slate-100"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Premium innovation ({iStats.done}/{iStats.total})
        </button>
      </div>

      {tab === "parity" ? (
        <>
          <Card
            className={
              parityComplete
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
                : "border-violet-200 bg-gradient-to-br from-violet-50/80 to-white"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${
                    parityComplete ? "text-emerald-700" : "text-violet-700"
                  }`}
                >
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
                {!parityComplete ? (
                  <Button type="button" variant="secondary" onClick={() => setFilter("missing")}>
                    Show gaps only
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => setFilter("done")}>
                    Browse done list
                  </Button>
                )}
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
              <li>Legacy feature rows are all Done — walk the React desks against legacy workflows.</li>
              <li>Use test hints on each Done row while you verify.</li>
              <li>
                When React feels equal or better, say <strong>“Approve migration.”</strong>
              </li>
              <li>
                Only then do we switch the default homepage from legacy to{" "}
                <code className="rounded bg-slate-100 px-1">/app/</code>.
              </li>
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
                {key === "partial" ? ` (${stats.partial})` : ""}
                {key === "missing" ? ` (${stats.missing})` : ""}
              </button>
            ))}
          </div>

          {filteredGroups.length === 0 ? (
            <Card className="border-emerald-200 bg-emerald-50/60">
              <p className="text-sm font-semibold text-emerald-900">
                No {filter} legacy features left — filter is empty because everything is Done.
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                The Phase 6–14 list below is a completed roadmap summary, not outstanding work.
              </p>
              <Button type="button" className="mt-3" variant="secondary" onClick={() => setFilter("all")}>
                Show all features
              </Button>
            </Card>
          ) : (
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
                              const cfg = parityStatusConfig[f.status];
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
                                        <Link
                                          href={f.react}
                                          className="font-semibold text-sky-700 hover:underline"
                                        >
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
          )}

          {(filter === "all" || filter === "done") && (
            <Card>
              <p className="text-sm font-semibold text-[var(--color-atlas-navy)]">
                Completed phase roadmap (reference)
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                These are the phases we shipped — not a backlog. Switch to{" "}
                <button
                  type="button"
                  className="font-semibold text-violet-700 hover:underline"
                  onClick={() => setTab("innovation")}
                >
                  Premium innovation
                </button>{" "}
                for the dual-track tech list.
              </p>
              <div className="mt-4 space-y-2">
                {plannedPhases.map((p) => (
                  <div
                    key={p.phase}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3"
                  >
                    <Badge tone="success">Phase {p.phase}</Badge>
                    <span className="font-bold text-[var(--color-atlas-navy)]">{p.title}</span>
                    <span className="text-sm text-[var(--color-text-muted)]">— {p.items}</span>
                    <Badge tone="success">Shipped</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card
            className={
              innovationComplete
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white"
                : "border-violet-200 bg-gradient-to-br from-violet-50/80 to-white"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${
                    innovationComplete ? "text-emerald-700" : "text-violet-700"
                  }`}
                >
                  {innovationComplete
                    ? "Premium innovation complete"
                    : "Premium tech — Phase 0 → cutover"}
                </p>
                <p className="mt-2 text-2xl font-extrabold text-[var(--color-atlas-navy)]">
                  {iStats.done} of {iStats.total} shipped
                  {!innovationComplete
                    ? ` · ${iStats.partial} partial · ${iStats.planned} planned`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="success">{iStats.done} done</Badge>
                  <Badge tone="info">{iStats.retrofit} retrofit</Badge>
                  <Badge tone="warn">{iStats.partial} partial</Badge>
                  <Badge tone="neutral">{iStats.planned} planned</Badge>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)]">
                See TECH_VISION.md in repo
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${Math.round((iStats.done / Math.max(1, iStats.total)) * 100)}%` }}
              />
            </div>
          </Card>

          <Card className="border-indigo-200 bg-indigo-50/50">
            <h2 className="font-bold text-[var(--color-atlas-navy)]">Dual-track rule</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Every phase = <strong>legacy parity</strong> + <strong>innovation slice</strong> +{" "}
              <strong>retrofit</strong> when we find gaps in earlier phases. This is a new version — not a
              minimal port.
            </p>
          </Card>

          <div className="flex flex-wrap gap-2">
            {(["all", "done", "retrofit", "partial", "planned"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setIFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
                  iFilter === key
                    ? "bg-violet-700 text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-slate-50"
                }`}
              >
                {key === "all" ? "All items" : key}
                {key === "partial" ? ` (${iStats.partial})` : ""}
                {key === "planned" ? ` (${iStats.planned})` : ""}
              </button>
            ))}
          </div>

          {innovationByPhase.length === 0 ? (
            <Card className="border-emerald-200 bg-emerald-50/60">
              <p className="text-sm font-semibold text-emerald-900">
                No {iFilter} innovation items — everything in this track is Shipped.
              </p>
              <Button
                type="button"
                className="mt-3"
                variant="secondary"
                onClick={() => setIFilter("all")}
              >
                Show all items
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {innovationByPhase.map(({ phase, items }) => (
                <Card key={phase} className="overflow-hidden p-0">
                  <div className="border-b border-[var(--color-border)] bg-slate-50 px-5 py-3">
                    <h2 className="font-bold text-[var(--color-atlas-navy)]">
                      Phase {phase}
                      <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                        {items.filter((i) => i.status === "done").length}/{items.length} shipped
                      </span>
                    </h2>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="text-xs uppercase text-[var(--color-text-muted)]">
                      <tr>
                        <th className="px-4 py-2 text-left">Innovation</th>
                        <th className="px-4 py-2 text-left">Why</th>
                        <th className="px-4 py-2 text-left">In React</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const cfg = innovationStatusConfig[item.status];
                        const Icon = cfg.icon;
                        return (
                          <tr key={item.id} className="border-t align-top">
                            <td className="px-4 py-3 font-semibold">{item.name}</td>
                            <td className="px-4 py-3 text-[var(--color-text-muted)]">{item.why}</td>
                            <td className="px-4 py-3">
                              {item.react ? (
                                item.react.startsWith("/") ? (
                                  <Link
                                    href={item.react}
                                    className="font-semibold text-sky-700 hover:underline"
                                  >
                                    {item.react}
                                  </Link>
                                ) : (
                                  <span className="text-[var(--color-text-muted)]">{item.react}</span>
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Icon
                                  className={`h-4 w-4 ${
                                    item.status === "done"
                                      ? "text-emerald-600"
                                      : item.status === "retrofit"
                                        ? "text-violet-600"
                                        : item.status === "partial"
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
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
