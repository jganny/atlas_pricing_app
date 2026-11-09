"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Mail, Phone } from "lucide-react";
import { useDirectory } from "@/hooks/use-atlas-data";
import { findCarrierContacts, noticesFor, PER_KG_BREAKS, type BoardTariff, type CarrierRule, type Freight } from "@/lib/carriers/board";
import { fetchFuelNotices } from "@/lib/firebase/carrier-board";
import { cn } from "@/lib/utils";

const NONE: never[] = [];
type Tab = "rates" | "surcharges" | "contacts" | "portal" | "remarks";
const LABEL: Record<Tab, string> = { rates: "Rates", surcharges: "Surcharges", contacts: "Contacts", portal: "Portal", remarks: "Remarks" };
const whole = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (s: string) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "no date");

/**
 * What a user wants to know about one airline, in one place under its row: the rates, the fuel and security surcharges the reader
 * has written down, who to contact (from the Directory), how to use its portal, and the remarks. Closed tabs cost nothing.
 */
export function AirlineDetail({ code, name, rule, tariff, freight, currency, initial }: { code: string; name: string; rule?: CarrierRule; tariff?: BoardTariff; freight?: Freight; currency: string; initial?: Tab }) {
  const tabs: Tab[] = tariff ? ["rates", "surcharges", "contacts", "portal", "remarks"] : ["surcharges", "contacts", "portal", "remarks"];
  const [tab, setTab] = useState<Tab>(initial && tabs.includes(initial) ? initial : tabs[0]);
  const { data } = useDirectory();
  const contacts = useMemo(() => findCarrierContacts(data ?? NONE, code, name), [data, code, name]);
  const notices = useQuery({ queryKey: ["carrier-board", "fuel-notices"], queryFn: fetchFuelNotices, staleTime: 5 * 60_000, enabled: tab === "surcharges" });
  const mine = useMemo(() => noticesFor(notices.data ?? [], code), [notices.data, code]);
  const breakLabel = freight ? PER_KG_BREAKS.find((b) => b.key === freight.key)?.label ?? "" : "";

  return (
    <div className="pb-5" data-testid={`board-detail-${code}`}>
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]" role="tablist">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === t ? "border-[var(--color-atlas-ink)] font-semibold text-[var(--color-text)]" : "border-transparent text-[var(--color-text-muted)]")}>
            {LABEL[t]}
          </button>
        ))}
      </div>
      <div className="pt-4 text-sm">
        {tab === "rates" && tariff && freight ? (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-[var(--color-surface-muted)] px-4 py-3 sm:grid-cols-4">
              <div><dt className="text-xs text-[var(--color-text-muted)]">Rate per kg</dt><dd className="font-semibold tabular-nums">{whole(freight.perKg)} at {breakLabel} kg</dd></div>
              <div><dt className="text-xs text-[var(--color-text-muted)]">Freight</dt><dd className="font-semibold tabular-nums">{currency} {money(freight.freight)}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-muted)]">Valid</dt><dd className="font-semibold">{tariff.validFrom ? `${dateText(tariff.validFrom)} to ` : "to "}{dateText(tariff.validTo)}</dd></div>
              <div><dt className="text-xs text-[var(--color-text-muted)]">Rate type</dt><dd className="font-semibold capitalize">{tariff.rateKind}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-[var(--color-text-muted)]">
              {tariff.breaks.min ? <span>MIN {whole(tariff.breaks.min)}</span> : null}
              {PER_KG_BREAKS.map((b) => <span key={b.key} className={cn(b.key === freight.key && "font-semibold text-[var(--color-text)]")}>{b.label} {tariff.breaks[b.key] ? whole(Number(tariff.breaks[b.key])) : "\u2014"}</span>)}
            </div>
          </>
        ) : null}

        {tab === "surcharges" ? (
          notices.isLoading ? (
            <p className="text-[var(--color-text-muted)]">Loading\u2026</p>
          ) : mine.length ? (
            <div className="space-y-4">
              {mine.slice(0, 3).map((n) => (
                <div key={n.circularId} className="rounded-lg border border-[var(--color-border)] p-3" data-testid="fuel-notice">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <b className="font-semibold">{n.title || "Fuel notice"}</b>
                    <span className="text-xs text-[var(--color-text-muted)]">{n.effectiveFrom || n.validTo ? `${n.effectiveFrom ? dateText(n.effectiveFrom) : "\u2026"} to ${n.validTo ? dateText(n.validTo) : "\u2026"}` : "no dates printed"}</span>
                  </div>
                  {n.summary.length ? <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[var(--color-text-muted)]">{n.summary.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul> : null}
                  {n.charges.length ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[380px] border-collapse text-xs">
                        <thead><tr className="border-b border-[var(--color-border-strong)] text-left text-[var(--color-text-muted)]"><th className="py-1 pr-3">Charge</th><th className="py-1 pr-3 text-right">Amount</th><th className="py-1 pr-3">Per</th><th className="py-1">Applies to</th></tr></thead>
                        <tbody>
                          {n.charges.slice(0, 12).map((c, i) => (
                            <tr key={i} className="border-b border-[var(--color-border)] last:border-b-0">
                              <td className="py-1 pr-3 font-semibold">{c.name}</td>
                              <td className="py-1 pr-3 text-right tabular-nums">{c.amount === null ? "\u2014" : `${c.currency ? `${c.currency} ` : ""}${c.amount.toLocaleString("en-IN")}`}</td>
                              <td className="py-1 pr-3 text-[var(--color-text-muted)]">{c.unit}</td>
                              <td className="py-1 text-[var(--color-text-muted)]">{c.appliesTo}{c.note ? ` \u00b7 ${c.note}` : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {n.deadlines.length ? <p className="mt-2 text-xs text-amber-800">Dates to act by: {n.deadlines.join(" \u00b7 ")}</p> : null}
                </div>
              ))}
              <p className="text-xs text-[var(--color-text-muted)]">Written by the reader from the airline&apos;s own notice. Surcharges are shown here for reference and are not added to the totals above. Check the original before quoting.</p>
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)]">No fuel or security notice has been read for {name} yet. Upload its fuel circular on the <Link href="/circulars" className="font-semibold text-[var(--color-atlas-navy)] underline underline-offset-2">Circulars page</Link> (category Fuel (Airline)) and it appears here.</p>
          )
        ) : null}

        {tab === "contacts" ? (
          contacts.length ? (
            <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="airline-contacts">
              {contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="font-semibold">{c.contactPerson || c.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{[c.contactPerson ? c.name : "", c.location].filter(Boolean).join(" \u00b7 ") || "Airline cargo"}</div>
                    {c.notes ? <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{c.notes}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.email ? <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface-muted)]"><Mail className="h-3.5 w-3.5" />{c.email}</a> : null}
                    {c.phone ? <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface-muted)]"><Phone className="h-3.5 w-3.5" />{c.phone}</a> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--color-text-muted)]">No contact for {name} in the Directory yet. Add one under <Link href="/directory" className="font-semibold text-[var(--color-atlas-navy)] underline underline-offset-2">Directory</Link> (category Airline) and it appears here, and in the draft emails.</p>
          )
        ) : null}

        {tab === "portal" ? (
          rule?.portalUrl ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <a href={rule.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-atlas-navy)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-atlas-ink)]">Open portal <ExternalLink className="h-3.5 w-3.5" /></a>
                <span className="break-all text-xs text-[var(--color-text-muted)]">{rule.portalUrl}</span>
              </div>
              <p>{rule.remark}</p>
              {rule.stations?.length ? <p className="text-[var(--color-text-muted)]">Your team holds logins for: <b className="font-semibold text-[var(--color-text)]">{rule.stations.join(", ")}</b>. Sign in with your own login; nothing is stored in this app.</p> : null}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)]">{name} is not in the procurement sheet, so it has no portal on record. {tariff ? "Use the tariff, or ask by email." : "Ask by email for every weight break."}</p>
          )
        ) : null}

        {tab === "remarks" ? (
          <div className="space-y-2">
            {rule ? <p><b className="font-semibold">How to get this airline&apos;s rate:</b> {rule.remark}</p> : <p><b className="font-semibold">How to get this airline&apos;s rate:</b> not in the procurement sheet, so a tariff on file is used, otherwise ask by email.</p>}
            {tariff ? (
              <>
                {tariff.notes ? <p><b className="font-semibold">Note from the tariff:</b> {tariff.notes}</p> : null}
                <p className="text-[var(--color-text-muted)]">Rate type {tariff.rateKind}. {tariff.sourceFile ? `From ${tariff.sourceFile}. ` : ""}Read twice, independently; saved because both reads agreed.</p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
