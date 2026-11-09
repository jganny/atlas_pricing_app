"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { fetchLiveCirculars } from "@/lib/firebase/circulars";
import { fetchAutoReadSettings, readCarrierCircular, saveAutoReadSettings, type ReadResult } from "@/lib/firebase/carrier-board";

/** Roughly what one airline circular costs to read twice (practice reads cost the same). */
export const READ_COST_NOTE = "about $0.25";


/**
 * For the admin only (the server checks too): read an airline circular so its rates reach the Carrier Board and the Air desk.
 * A practice read ("Check only") saves nothing. Each read uses the AI and costs money, so the admin presses the button.
 */
export function CarrierReaderPanel() {
  const qc = useQueryClient();
  const circulars = useQuery({ queryKey: ["carrier-board", "circulars"], queryFn: fetchLiveCirculars, staleTime: 60_000 });
  const settings = useQuery({ queryKey: ["carrier-board", "auto-settings"], queryFn: fetchAutoReadSettings, staleTime: 30_000 });
  const [autoEdit, setAutoEdit] = useState<{ enabled?: boolean; cap?: string }>({});
  const autoOn = autoEdit.enabled ?? settings.data?.enabled ?? true;
  const autoCap = autoEdit.cap ?? String(settings.data?.monthlyCapUsd ?? 3);
  async function saveAuto() {
    try {
      await saveAutoReadSettings({ enabled: autoOn, monthlyCapUsd: Number(autoCap) });
      await qc.invalidateQueries({ queryKey: ["carrier-board", "auto-settings"] });
      setAutoEdit({});
      toast("Auto-read settings saved.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    }
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; res: ReadResult } | null>(null);

  const list = (circulars.data ?? []).filter((c) => c.category === "airline_tariff" && c.storagePath);

  async function run(id: string, title: string, dryRun: boolean) {
    const ok = window.confirm(`${dryRun ? "Check" : "Read and save"} "${title}"?\n\nThis uses the AI (${READ_COST_NOTE}) and can take a few minutes.${dryRun ? " Nothing is saved." : " Agreed rates are saved to the Carrier Board and sent to the Air desk."}`);
    if (!ok) return;
    setBusy(id);
    setResult(null);
    try {
      const res = await readCarrierCircular(id, dryRun);
      setResult({ title, res });
      if (!dryRun) await Promise.all([qc.invalidateQueries({ queryKey: ["carrier-board"] }), qc.invalidateQueries({ queryKey: ["airTariffs"] })]);
      toast(dryRun ? "Check finished. Nothing was saved." : "Read finished. Rates are on the Carrier Board.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The read did not finish.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-white" aria-label="Read circulars" data-testid="carrier-reader-panel">
      <div className="border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-sm font-extrabold text-[var(--color-atlas-navy)]">Automatic reading and manual reads</h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Administrators only. Whoever uploads a circular is told on screen, straight away, how its read went. This box is only for the switch and the limit, and for reading one by hand if you ever need to.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-3" data-testid="auto-read-settings">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-atlas-navy)]">
          <input type="checkbox" checked={autoOn} onChange={(e) => setAutoEdit((x) => ({ ...x, enabled: e.target.checked }))} />
          Read automatically when an airline circular is uploaded
        </label>
        <label className="text-xs font-semibold text-[var(--color-text-muted)]">
          Monthly limit, US dollars
          <input value={autoCap} onChange={(e) => setAutoEdit((x) => ({ ...x, cap: e.target.value }))} inputMode="decimal" className="mt-1 block h-9 w-24 rounded-lg border border-[var(--color-border-strong)] bg-white px-2 text-sm text-[var(--color-text)]" aria-label="Monthly limit in dollars" />
        </label>
        <Button size="sm" onClick={saveAuto} disabled={autoEdit.enabled === undefined && autoEdit.cap === undefined}>Save</Button>
        <p className="basis-full text-xs text-[var(--color-text-muted)]">An airline rate circular costs {READ_COST_NOTE}; any other circular&apos;s summary costs a few cents. When the month&apos;s reading would pass the limit, the uploader is told it is waiting.</p>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {list.map((c) => {
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-text)]">{c.title || c.fileName}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{c.carrier || "Airline"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => run(c.id, c.title || c.fileName || c.id, true)}>Check only</Button>
                <Button size="sm" disabled={busy !== null} onClick={() => run(c.id, c.title || c.fileName || c.id, false)}>
                  {busy === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Read and save
                </Button>
              </div>
            </li>
          );
        })}
        {!list.length ? <li className="px-5 py-4 text-sm text-[var(--color-text-muted)]">{circulars.isLoading ? "Loading circulars…" : "No airline tariff circulars with a file yet. Upload one on the Circulars page (category Airline Tariff)."}</li> : null}
      </ul>
      {result ? (
        <div className="border-t border-[var(--color-border)] px-5 py-3 text-sm" data-testid="carrier-read-result">
          <div className="font-semibold text-[var(--color-atlas-navy)]">{result.res.dryRun ? "Check" : "Saved"}: {result.title}</div>
          <div className="text-[var(--color-text-muted)]">
            {result.res.applied} routes agreed{result.res.dryRun ? " (nothing saved)" : `, ${result.res.publishedToAirDesk ?? 0} sent to the Air desk`}; {result.res.held} held; {result.res.unchanged} unchanged.
          </div>
          {result.res.holdDetails.length ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-[var(--color-text-muted)]">
              {result.res.holdDetails.slice(0, 5).map((h, i) => <li key={i}>{h.route || "Whole file"}: {h.reasons.join(" ")}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
