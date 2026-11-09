"use client";

import { MAP_BANDS, PER_KG_BREAKS, CARRIER_RULES, bandIndex, breakKeyFor, ruleFor, ruleText, sourceFor, type LaneView, type PricedRow } from "@/lib/carriers/board";
import { cn } from "@/lib/utils";

const SERIES = ["#2563eb", "#0f8b7e", "#c2410c", "#b45309", "#475569", "#be185d"];
const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

const SOURCE_STYLE = {
  Tariff: "bg-emerald-100 text-emerald-800",
  Portal: "bg-blue-100 text-blue-800",
  Email: "bg-amber-100 text-amber-900",
} as const;

/** Rate per kg at each weight break, one step line per airline; the shaded band is the shipment's weight. */
export function CompareChart({ lane, weightKg }: { lane: LaneView; weightKg: number }) {
  const rows = lane.priced;
  if (!rows.length) return <p className="text-sm text-[var(--color-text-muted)]">No airline has a tariff on this lane yet.</p>;
  const L = 48, R = 84, T = 22, B = 44, W = 560, H = 290;
  const pw = W - L - R, ph = H - T - B, bw = pw / PER_KG_BREAKS.length;
  let lo = Infinity, hi = 0;
  for (const r of rows) for (const b of PER_KG_BREAKS) {
    const v = Number(r.tariff.breaks[b.key]);
    if (v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const step = Math.max(1, Math.ceil((hi - lo) / 4 / 5) * 5) || 1;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;
  const Y = (v: number) => T + ph * (1 - (v - lo) / (hi - lo));
  const ci = PER_KG_BREAKS.findIndex((b) => b.key === breakKeyFor(weightKg));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const labels = rows.map((r, i) => {
    const last = [...PER_KG_BREAKS].reverse().map((b) => Number(r.tariff.breaks[b.key])).find((v) => v > 0) ?? 0;
    return { r, i, y: Y(last) + 4, v: last };
  }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[640px]" role="img" aria-label="Rate per kilogram for each airline at each weight break">
      <rect x={L + ci * bw} y={T} width={bw} height={ph} fill="#e7edfc" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={L + pw} y1={Y(v)} y2={Y(v)} stroke="#e4e8ef" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="#7d889b">{fmt(v)}</text>
        </g>
      ))}
      {PER_KG_BREAKS.map((b, i) => (
        <text key={b.key} x={L + i * bw + bw / 2} y={T + ph + 17} textAnchor="middle" fontSize="11.5" fill={i === ci ? "#0e1522" : "#7d889b"} fontWeight={i === ci ? 600 : 400}>{b.label}</text>
      ))}
      <text x={L + pw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#7d889b">weight break, kg</text>
      <text x={L} y={T - 8} fontSize="11" fill="#7d889b">{lane.currency} per kg</text>
      {rows.map((r, i) => {
        let d = "";
        PER_KG_BREAKS.forEach((b, k) => {
          const v = Number(r.tariff.breaks[b.key]);
          if (!(v > 0)) return;
          const x0 = L + k * bw, x1 = x0 + bw;
          d += d ? ` V${Y(v)} H${x1}` : `M${x0} ${Y(v)} H${x1}`;
        });
        return <path key={r.code} d={d} fill="none" stroke={SERIES[i % SERIES.length]} strokeWidth={2.25} strokeLinejoin="round" />;
      })}
      {labels.map((l) => (
        <text key={l.r.code} x={L + pw + 8} y={l.y} fontSize="11.5" fontWeight={600} fill={SERIES[l.i % SERIES.length]}>{l.r.code} {fmt(l.v)}</text>
      ))}
    </svg>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isoDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`).getTime() : null);

/** How long each airline's tariff stays valid. The dark line is today. */
export function ValidityTimeline({ rows, today }: { rows: PricedRow[]; today: Date }) {
  const dated = rows.filter((r) => isoDay(r.tariff.validTo) !== null);
  if (!dated.length) return <p className="text-sm text-[var(--color-text-muted)]">No tariff on this lane has a validity date.</p>;
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastEnd = Math.max(...dated.map((r) => isoDay(r.tariff.validTo) ?? 0));
  const end = new Date(Math.max(lastEnd, new Date(today.getFullYear(), today.getMonth() + 5, 1).getTime()));
  const S = first.getTime(), span = end.getTime() - S;
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - S) / span) * 100));
  const months: Array<{ label: string; t: number }> = [];
  for (let d = new Date(first); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ label: MONTHS[d.getMonth()], t: d.getTime() });
  const todayT = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const color = { ok: "bg-emerald-600", soon: "bg-amber-500", expired: "bg-red-600", none: "bg-slate-400" } as const;
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const from = isoDay(r.tariff.validFrom) ?? S, to = isoDay(r.tariff.validTo);
        return (
          <div key={r.code} className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-3 text-xs sm:grid-cols-[120px_minmax(0,1fr)_80px]">
            <span className="truncate font-semibold text-[var(--color-atlas-navy)]">{r.code} <span className="font-normal text-[var(--color-text-muted)]">{r.name.split(" ")[0]}</span></span>
            <span className="relative h-5 overflow-hidden rounded bg-[var(--color-surface-muted)]">
              {months.map((m) => <i key={m.t} className="absolute inset-y-0 w-px bg-[var(--color-border)]" style={{ left: `${pct(m.t)}%` }} />)}
              {to !== null ? <i className={cn("absolute inset-y-1 rounded-sm", color[r.validity])} style={{ left: `${pct(from)}%`, width: `${Math.max(3, pct(to) - pct(from))}%` }} /> : null}
              <i className="absolute inset-y-0 w-0.5 bg-[var(--color-atlas-ink)]" style={{ left: `${pct(todayT)}%` }} />
            </span>
            <span className={cn("text-right font-mono", r.validity === "expired" ? "text-red-700" : r.validity === "soon" ? "text-amber-700" : "text-[var(--color-text-muted)]")}>{r.tariff.validTo || "no date"}</span>
          </div>
        );
      })}
      <div className="grid grid-cols-[96px_minmax(0,1fr)_72px] gap-3 text-[11px] text-[var(--color-text-muted)] sm:grid-cols-[120px_minmax(0,1fr)_80px]">
        <span />
        <span className="relative h-4">{months.map((m) => <span key={m.t} className="absolute" style={{ left: `calc(${pct(m.t)}% + 3px)` }}>{m.label}</span>)}</span>
        <span className="text-right">valid to</span>
      </div>
    </div>
  );
}

/** Which source gives the rate for each weight band, airline by airline. The shipment's band is outlined. */
export function ProcurementMap({ lane, weightKg }: { lane: LaneView; weightKg: number }) {
  const ci = bandIndex(weightKg);
  const codes = new Map<string, { name: string; has: boolean }>();
  for (const r of CARRIER_RULES) codes.set(r.code, { name: r.name, has: false });
  for (const p of lane.priced) codes.set(p.code, { name: p.name, has: true });
  for (const o of lane.other) if (!codes.has(o.code)) codes.set(o.code, { name: o.name, has: false });
  const rows = [...codes.entries()];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-xs">
        <thead>
          <tr className="text-[var(--color-text-muted)]">
            <th className="text-left font-normal" />
            {MAP_BANDS.map((b, i) => <th key={b.label} className={cn("px-1 text-center font-normal", i === ci && "font-semibold text-blue-700")}>{b.label} kg</th>)}
            <th className="pl-2 text-left font-normal">Rule</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, info]) => (
            <tr key={code}>
              <td className="whitespace-nowrap pr-3 font-semibold text-[var(--color-atlas-navy)]">{code} <span className="font-normal text-[var(--color-text-muted)]">{info.name.split(" ")[0]}</span></td>
              {MAP_BANDS.map((b, i) => {
                const s = sourceFor(ruleFor(code), b.rep, info.has);
                return <td key={b.label} className="px-0.5"><span className={cn("block rounded-md py-1 text-center font-semibold", SOURCE_STYLE[s], i === ci && "ring-2 ring-blue-600")}>{s}</span></td>;
              })}
              <td className="whitespace-nowrap pl-2 text-[var(--color-text-muted)]">{ruleText(ruleFor(code))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
