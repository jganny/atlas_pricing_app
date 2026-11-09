"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, PlaneTakeoff } from "lucide-react";
import { loadAirlineNames } from "@/lib/carriers/airline-names";
import { buildLane, PER_KG_BREAKS, type LaneView, type OtherRow, type PricedRow } from "@/lib/carriers/board";
import { fetchLaneTariffs } from "@/lib/firebase/carrier-board";
import { activeSeatForLogin } from "@/lib/auth/desk-seats";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { CarrierReaderPanel } from "./CarrierReaderPanel";
import { CompareChart, ProcurementMap, ValidityTimeline } from "./CarrierBoardViews";
import { RateEmailDialog, type RateEmailTarget } from "./RateEmailDialog";

type Mode = "simple" | "detailed";
type View = "cmp" | "val" | "map";
const MODE_KEY = "atlas-carrier-board-mode";
const LANE_KEY = "atlas-carrier-board-lane";

// Remembered choices (the screen's detail level and the last lane) live in this browser only. Read through
// useSyncExternalStore so the first paint matches the server and nothing is set inside an effect.
const listeners = new Set<() => void>();
function subscribeStore(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the screen works without remembering */
  }
  listeners.forEach((l) => l());
}
const useStored = (key: string) => useSyncExternalStore(subscribeStore, () => readStore(key), () => null);

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const dateText = (s: string) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "no date");

const SRC_DOT = { Tariff: "bg-emerald-600", Portal: "bg-blue-600", Email: "bg-amber-500" } as const;
const SRC_TEXT = { Tariff: "text-emerald-700", Portal: "text-blue-700", Email: "text-amber-700" } as const;

function Source({ s }: { s: keyof typeof SRC_DOT }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", SRC_TEXT[s])}>
      <i className={cn("h-2 w-2 rounded-full", SRC_DOT[s])} />
      {s}
    </span>
  );
}

function validityNote(r: PricedRow): { text: string; tone: string } {
  if (r.days === null) return { text: "no end date", tone: "text-[var(--color-text-muted)]" };
  if (r.days < 0) return { text: `expired ${-r.days} days ago`, tone: "font-semibold text-red-700" };
  if (r.days <= 30) return { text: `valid ${r.days} more days`, tone: "font-semibold text-amber-700" };
  return { text: `valid to ${dateText(r.tariff.validTo)}`, tone: "text-[var(--color-text-muted)]" };
}

function PricedRowView({ r, currency, first, open, detailed, onToggle }: { r: PricedRow; currency: string; first: boolean; open: boolean; detailed: boolean; onToggle: () => void }) {
  const v = validityNote(r);
  const breakLabel = PER_KG_BREAKS.find((b) => b.key === r.freight.key)?.label ?? "";
  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0" data-testid={`board-row-${r.code}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-4 gap-y-1 py-4 text-left sm:grid-cols-[minmax(0,1.4fr)_88px_minmax(170px,1fr)_16px]", detailed && "lg:grid-cols-[minmax(0,1.4fr)_88px_100px_minmax(170px,1fr)_16px]")}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-md border border-[var(--color-border-strong)] px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-[var(--color-text-muted)]">{r.code}</span>
          <b className="truncate text-[15px] font-semibold text-[var(--color-text)]">{r.name}</b>
          {first && r.validity !== "expired" ? <em className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold not-italic text-emerald-800">Lowest</em> : null}
        </span>
        <span className="hidden sm:block"><Source s="Tariff" /></span>
        {detailed ? <span className="hidden text-right text-sm tabular-nums lg:block">{whole(r.freight.perKg)} <span className="text-[var(--color-text-muted)]">{breakLabel}</span></span> : null}
        <span className="whitespace-nowrap text-right tabular-nums">
          <span className="block text-base font-semibold">{currency} {money(r.freight.freight)}</span>
          <small className={cn("block text-xs", v.tone)}>{v.text}</small>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[var(--color-text-muted)] transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="pb-5" data-testid={`board-detail-${r.code}`}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-[var(--color-surface-muted)] px-4 py-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-[var(--color-text-muted)]">Rate per kg</dt><dd className="font-semibold tabular-nums">{whole(r.freight.perKg)} at {breakLabel} kg</dd></div>
            <div><dt className="text-xs text-[var(--color-text-muted)]">Freight</dt><dd className="font-semibold tabular-nums">{money(r.freight.freight)}</dd></div>
            <div><dt className="text-xs text-[var(--color-text-muted)]">Valid</dt><dd className="font-semibold">{r.tariff.validFrom ? `${dateText(r.tariff.validFrom)} to ` : "to "}{dateText(r.tariff.validTo)}</dd></div>
            <div><dt className="text-xs text-[var(--color-text-muted)]">Rate type</dt><dd className="font-semibold capitalize">{r.tariff.rateKind}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-[var(--color-text-muted)]">
            {r.tariff.breaks.min ? <span>MIN {whole(r.tariff.breaks.min)}</span> : null}
            {PER_KG_BREAKS.map((b) => <span key={b.key} className={cn(b.key === r.freight.key && "font-semibold text-[var(--color-text)]")}>{b.label} {r.tariff.breaks[b.key] ? whole(Number(r.tariff.breaks[b.key])) : "—"}</span>)}
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]"><b className="font-semibold text-[var(--color-text)]">Checked:</b> read twice, independently; this rate was saved because both reads agreed.{r.tariff.sourceFile ? ` From ${r.tariff.sourceFile}.` : ""}{r.tariff.notes ? ` Note: ${r.tariff.notes}` : ""}</p>
        </div>
      ) : null}
    </div>
  );
}

function OtherRowView({ o, weightKg, origin, destination, open, onToggle, onEmail }: { o: OtherRow; weightKg: number; origin: string; destination: string; open: boolean; onToggle: () => void; onEmail: (t: RateEmailTarget) => void }) {
  const ask = () =>
    onEmail({
      code: o.code,
      name: o.name,
      origin,
      destination,
      weightKg,
      allBreaks: !o.rule,
      aboveKg: o.rule?.portalUpToKg !== undefined && weightKg > o.rule.portalUpToKg ? o.rule.portalUpToKg : undefined,
    });
  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0" data-testid={`board-row-${o.code}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="grid min-w-0 grid-cols-[minmax(0,1fr)_16px] items-center gap-x-4 text-left sm:grid-cols-[minmax(0,1.5fr)_96px_minmax(0,1fr)_16px]">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-md border border-[var(--color-border-strong)] px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-[var(--color-text-muted)]">{o.code}</span>
            <b className="truncate text-[15px] font-semibold">{o.name}</b>
          </span>
          <span className="hidden sm:block"><Source s={o.source} /></span>
          <span className="hidden text-right text-sm text-[var(--color-text-muted)] sm:block">{o.source === "Portal" ? "Rate is taken online" : "Ask the airline"}</span>
          <ChevronDown className={cn("h-4 w-4 text-[var(--color-text-muted)] transition-transform", open && "rotate-180")} />
        </button>
        {o.source === "Portal" ? (
          o.rule?.portalUrl ? (
            <a href={o.rule.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--color-atlas-navy)] hover:bg-[var(--color-surface-muted)]">
              Open portal <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">Portal link not set up yet</span>
          )
        ) : (
          <button type="button" onClick={ask} className="inline-flex h-9 min-w-[128px] items-center justify-center rounded-lg bg-[var(--color-atlas-navy)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-atlas-ink)]">
            Draft email
          </button>
        )}
      </div>
      {open ? (
        <div className="pb-5 text-sm text-[var(--color-text-muted)]">
          <p>{o.rule?.remark ?? "This airline is not in the procurement sheet and has no tariff on file, so it is asked by email for every weight break."}</p>
          {o.why ? <p className="mt-1">{o.why}</p> : null}
          {o.source === "Portal" ? <button type="button" onClick={ask} className="mt-2 text-sm font-semibold text-[var(--color-atlas-navy)] underline underline-offset-2">Or ask by email instead</button> : null}
        </div>
      ) : null}
    </div>
  );
}

export function CarrierBoard() {
  const user = useAuthStore((s) => s.user);
  const admin = isAdminUser(user?.username, user?.role);
  const seat = activeSeatForLogin(user?.username)?.id;
  const buyFirst = seat === "air-nom" || seat === "sea-nom";
  const today = useMemo(() => new Date(), []);
  const laneRaw = useStored(LANE_KEY);

  const mode: Mode = useStored(MODE_KEY) === "detailed" ? "detailed" : "simple";
  const storedLane = useMemo(() => {
    try {
      return (JSON.parse(laneRaw || "null") ?? {}) as { from?: string; to?: string; weight?: string };
    } catch {
      return {};
    }
  }, [laneRaw]);
  const [edit, setEdit] = useState<{ from?: string; to?: string; weight?: string }>({});
  const from = edit.from ?? storedLane.from ?? "";
  const to = edit.to ?? storedLane.to ?? "";
  const weight = edit.weight ?? storedLane.weight ?? "300";
  const setLane = (patch: { from?: string; to?: string; weight?: string }) => {
    const next = { from, to, weight, ...patch };
    setEdit((e) => ({ ...e, ...patch }));
    writeStore(LANE_KEY, JSON.stringify(next));
  };
  const setFrom = (v: string) => setLane({ from: v });
  const setTo = (v: string) => setLane({ to: v });
  const setWeight = (v: string) => setLane({ weight: v });
  const [currency, setCurrency] = useState<string | undefined>();
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [attnOpen, setAttnOpen] = useState(false);
  const [email, setEmail] = useState<RateEmailTarget | null>(null);
  const pickMode = (m: Mode) => writeStore(MODE_KEY, m);

  const o = from.trim().toUpperCase();
  const d = to.trim().toUpperCase();
  const laneOk = /^[A-Z]{3}$/.test(o) && /^[A-Z]{3}$/.test(d);
  const w = parseFloat(weight) || 0;
  const tariffs = useQuery({ queryKey: ["carrier-board", "lane", o, d], queryFn: () => fetchLaneTariffs(o, d), enabled: laneOk, staleTime: 60_000 });
  const names = useQuery({ queryKey: ["carrier-board", "names"], queryFn: loadAirlineNames, staleTime: Infinity });
  const lane: LaneView | null = useMemo(() => (laneOk && w > 0 ? buildLane(tariffs.data ?? [], w, today, names.data ?? {}, currency) : null), [laneOk, w, tariffs.data, names.data, today, currency]);

  const live = lane?.priced.filter((p) => p.validity !== "expired") ?? [];
  const best = live[0];
  const detailed = mode === "detailed";
  const attn: Array<{ key: string; text: string; sub: string }> = [];
  for (const p of lane?.priced ?? []) {
    if (p.validity === "expired") attn.push({ key: `e${p.code}`, text: `${p.name} tariff expired`, sub: `Ended ${dateText(p.tariff.validTo)}. Ask the admin to upload the new circular.` });
    else if (p.validity === "soon") attn.push({ key: `s${p.code}`, text: `${p.name} tariff ends in ${p.days} days`, sub: `Valid to ${dateText(p.tariff.validTo)}.` });
  }
  if (lane?.otherCurrency.length) attn.push({ key: "cur", text: `${lane.otherCurrency.join(", ")} quote in another currency`, sub: "Switch currency above to see them." });

  const toggleView = (v: View) => setView((cur) => (cur === v ? null : v));
  const showView = (v: View) => detailed || view === v;

  return (
    <div className="mx-auto w-full space-y-7 transition-[max-width]" style={{ maxWidth: detailed ? 1180 : 920 }} data-testid="carrier-board">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Library</p>
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">Carrier board</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Airline rates, read from the circulars. You do not need to come here to quote: the Air desk adds these airlines and fills their rates by itself. Look here when you want to compare.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--color-border-strong)] bg-white p-0.5" role="group" aria-label="Screen detail">
          {(["simple", "detailed"] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => pickMode(m)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold capitalize", mode === m ? "bg-[var(--color-atlas-navy)] text-white" : "text-[var(--color-text-muted)]")}>
              {m}
            </button>
          ))}
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-3" aria-label="Lane and weight">
        {[
          { id: "cb-from", label: "From", value: from, set: setFrom, ph: "BLR", w: "w-28" },
          { id: "cb-to", label: "To", value: to, set: setTo, ph: "FRA", w: "w-28" },
        ].map((f, i) => (
          <div key={f.id} className="flex items-end gap-3">
            {i === 1 ? <span className="pb-2.5 text-lg text-[var(--color-text-muted)]" aria-hidden>→</span> : null}
            <label className="block text-xs font-semibold text-[var(--color-text-muted)]" htmlFor={f.id}>
              {f.label}
              <input id={f.id} value={f.value} maxLength={3} placeholder={f.ph} onChange={(e) => f.set(e.target.value.toUpperCase())} className={cn("mt-1 block h-11 rounded-xl border border-[var(--color-border-strong)] bg-white px-3 font-mono text-lg font-semibold uppercase text-[var(--color-text)]", f.w)} />
            </label>
          </div>
        ))}
        <label className="block text-xs font-semibold text-[var(--color-text-muted)]" htmlFor="cb-weight">
          Weight, kg
          <input id="cb-weight" value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value)} className="mt-1 block h-11 w-32 rounded-xl border border-[var(--color-border-strong)] bg-white px-3 font-mono text-lg font-semibold text-[var(--color-text)]" />
        </label>
        <div className="grow" />
        {lane && lane.currencies.length > 1 ? (
          <div className="inline-flex rounded-xl border border-[var(--color-border-strong)] bg-white p-0.5" role="group" aria-label="Currency">
            {lane.currencies.map((c) => (
              <button key={c} type="button" aria-pressed={lane.currency === c} onClick={() => setCurrency(c)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold", lane.currency === c ? "bg-[var(--color-atlas-ink)] text-white" : "text-[var(--color-text-muted)]")}>
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {!laneOk ? (
        <section className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-white px-6 py-10 text-center" data-testid="board-empty">
          <p className="text-base font-semibold text-[var(--color-atlas-navy)]">Type the airports and the weight</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">For example BLR to FRA at 300 kg. You will see every airline&apos;s rate, and how to get the ones that are not on file.</p>
        </section>
      ) : tariffs.isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading rates…</p>
      ) : lane ? (
        <>
          <section aria-live="polite" data-testid="board-answer">
            <div className="text-xs text-[var(--color-text-muted)]">Lowest buy rate · {o} to {d} · {whole(w)} kg</div>
            {best ? (
              <>
                <div className="mt-1 text-4xl font-medium tabular-nums tracking-tight">{lane.currency} {money(best.freight.freight)}<span className="ml-3 text-xl font-normal tracking-normal text-[var(--color-text-muted)]">{best.name}</span></div>
                <p className="mt-2 text-[var(--color-text-muted)]">{live.length} airline{live.length === 1 ? "" : "s"} priced from a tariff. {lane.other.length} need a portal login or an email.</p>
              </>
            ) : (
              <>
                <div className="mt-1 text-2xl font-medium">No tariff on file for this lane and weight</div>
                <p className="mt-2 text-[var(--color-text-muted)]">{lane.other.length ? "The airlines below can be asked for a rate." : "Ask the airlines in your Directory for a rate."}</p>
              </>
            )}
            <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
              {buyFirst
                ? "These are the airline's BUY rates. You enter your sell rate after the shipment is confirmed and the overseas profit share is agreed."
                : "These are the airline's rates, your cost. You enter your SELL rate first and punch in the BUY rate after the shipment is confirmed."}{" "}
              Fuel and security surcharges are not included yet.
            </p>
          </section>

          {attn.length ? (
            <div>
              {!detailed ? (
                <button type="button" onClick={() => setAttnOpen((x) => !x)} aria-expanded={attnOpen} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {attn.length} item{attn.length === 1 ? "" : "s"} need attention {attnOpen ? "▴" : "▾"}
                </button>
              ) : null}
              {detailed || attnOpen ? (
                <ul className={cn("rounded-xl bg-amber-50 px-4 py-1", !detailed && "mt-3")} data-testid="board-attention">
                  {attn.map((a) => (
                    <li key={a.key} className="border-b border-amber-200 py-2.5 text-sm last:border-b-0">
                      {a.text}
                      <small className="block text-xs text-[var(--color-text-muted)]">{a.sub}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {detailed ? (
            <section className="grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Key figures">
              {[
                { k: "Lowest buy total", v: best ? `${lane.currency} ${money(best.freight.freight)}` : "—", s: best?.name ?? "no tariff at this weight" },
                { k: "Median of priced airlines", v: lane.median !== null ? `${lane.currency} ${money(lane.median)}` : "—", s: `${live.length} airlines` },
                { k: "Spread, lowest to highest", v: lane.spreadPct !== null ? `${lane.spreadPct}%` : "—", s: lane.spreadPct !== null ? "between airlines" : "needs two airlines" },
                { k: "Priced from tariff", v: `${live.length} of ${lane.priced.length + lane.other.length}`, s: "both AI reads agreed" },
              ].map((c) => (
                <div key={c.k} className="bg-white px-4 py-3">
                  <span className="block text-xs text-[var(--color-text-muted)]">{c.k}</span>
                  <b className="block text-xl font-medium tabular-nums">{c.v}</b>
                  <em className="text-xs not-italic text-[var(--color-text-muted)]">{c.s}</em>
                </div>
              ))}
            </section>
          ) : null}

          {lane.priced.length ? (
            <section>
              <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"><span>Priced from tariff</span><span>{lane.priced.length}</span></div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-white px-5">
                {lane.priced.map((r) => (
                  <PricedRowView key={r.code} r={r} currency={lane.currency} first={r === best} open={open === r.code} detailed={detailed} onToggle={() => setOpen(open === r.code ? null : r.code)} />
                ))}
              </div>
            </section>
          ) : null}
          {lane.other.length ? (
            <section>
              <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"><span>Needs one more step</span><span>{lane.other.length}</span></div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-white px-5">
                {lane.other.map((x) => (
                  <OtherRowView key={x.code} o={x} weightKg={w} origin={o} destination={d} open={open === x.code} onToggle={() => setOpen(open === x.code ? null : x.code)} onEmail={setEmail} />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label="More views">
            {!detailed ? (
              <div className="flex gap-1 border-b border-[var(--color-border)]" role="tablist">
                {([["cmp", "Compare by weight"], ["val", "Tariff validity"], ["map", "How rates are obtained"]] as Array<[View, string]>).map(([v, label]) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => toggleView(v)} className={cn("-mb-px border-b-2 px-3.5 py-2.5 text-sm", view === v ? "border-[var(--color-atlas-ink)] font-semibold text-[var(--color-text)]" : "border-transparent text-[var(--color-text-muted)]")}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className={cn("mt-4 grid gap-4", detailed && "lg:grid-cols-2")}>
              {showView("cmp") ? <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5" data-testid="view-cmp"><h2 className="mb-2 text-sm font-bold">Rate per kg by weight break</h2><CompareChart lane={lane} weightKg={w} /></div> : null}
              {showView("val") ? <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5" data-testid="view-val"><h2 className="mb-3 text-sm font-bold">Tariff validity</h2><ValidityTimeline rows={lane.priced} today={today} /></div> : null}
              {showView("map") ? <div className={cn("rounded-2xl border border-[var(--color-border)] bg-white p-5", detailed && "lg:col-span-2")} data-testid="view-map"><h2 className="mb-1 text-sm font-bold">How each airline&apos;s rate is obtained, by weight</h2><p className="mb-3 text-xs text-[var(--color-text-muted)]">From the remarks in your procurement sheet. An airline not in the sheet is asked by email unless a tariff is on file.</p><ProcurementMap lane={lane} weightKg={w} /></div> : null}
            </div>
          </section>

          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <PlaneTakeoff className="h-4 w-4" /> Quoting this lane?
            <Link href="/air" className="font-semibold text-[var(--color-atlas-navy)] underline underline-offset-2">Open the Air desk</Link>
            <span>and the airlines above are already added with their rates.</span>
          </p>
        </>
      ) : null}

      {admin ? <CarrierReaderPanel /> : null}
      <RateEmailDialog target={email} onClose={() => setEmail(null)} />
    </div>
  );
}
