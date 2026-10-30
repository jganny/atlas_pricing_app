"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { ROLE_LABEL, roleOf, type CarrierFolder, type StationGroup } from "@/lib/circulars/folders";
import type { CircularRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_TONE = {
  tariff: "bg-sky-100 text-sky-900",
  fsc: "bg-amber-100 text-amber-900",
  circular: "bg-violet-100 text-violet-900",
  general: "bg-slate-200 text-slate-700",
} as const;

/** A role chip: Tariff, FSC, Circular or General. */
export function RoleChip({ category }: { category: string | undefined }) {
  const role = roleOf(category);
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ROLE_TONE[role])}>{ROLE_LABEL[role]}</span>;
}

function CarrierRow({ folder, open, onToggle, renderFile }: { folder: CarrierFolder; open: boolean; onToggle: () => void; renderFile: (c: CircularRecord) => ReactNode }) {
  const Icon = open ? FolderOpen : Folder;
  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm">
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")} />
        <Icon className="h-4 w-4 shrink-0 text-[var(--color-atlas-sky)]" />
        <span className="font-bold">{folder.label}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {folder.files.length} file{folder.files.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto flex gap-1">
          {folder.hasTariff ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ROLE_TONE.tariff)}>Tariff</span> : null}
          {folder.hasFsc ? <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ROLE_TONE.fsc)}>FSC</span> : null}
        </span>
      </button>
      {open ? <ul className="space-y-1.5 border-t border-[var(--color-border)] p-2">{folder.files.map((c) => renderFile(c))}</ul> : null}
    </li>
  );
}

/**
 * Station › airline / liner / courier › carrier folder. Folders open on tap; a search opens them all.
 * What a file's row shows (open link, actions) comes from the page through `renderFile`.
 */
export function CircularFolders({ groups, openAll, renderFile }: { groups: StationGroup[]; openAll: boolean; renderFile: (c: CircularRecord) => ReactNode }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [closedStations, setClosedStations] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // A single station needs no heading of its own — except "Station not set", which should always say so.
  const onlyOne = groups.length === 1 && groups[0].station !== null;
  return (
    <div className="space-y-3" data-testid="circular-folders">
      {groups.map((g) => {
        const sid = g.station ?? "none";
        const stationOpen = onlyOne || !closedStations.has(sid);
        return (
          <section key={sid} className="space-y-2">
            {onlyOne ? null : (
              <button
                type="button"
                aria-expanded={stationOpen}
                onClick={() =>
                  setClosedStations((prev) => {
                    const next = new Set(prev);
                    if (next.has(sid)) next.delete(sid);
                    else next.add(sid);
                    return next;
                  })
                }
                className="flex w-full items-center gap-2 text-left"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", stationOpen && "rotate-90")} />
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", g.station ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900")}>{g.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{g.fileCount} files</span>
              </button>
            )}
            {stationOpen
              ? g.kinds.map((k) => (
                  <div key={k.kind} className="space-y-1.5 pl-0 sm:pl-5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {k.label} · {k.fileCount}
                    </div>
                    <ul className="space-y-1.5">
                      {k.carriers.map((f) => {
                        const id = `${sid}|${k.kind}|${f.key}`;
                        return <CarrierRow key={id} folder={f} open={openAll || openIds.has(id)} onToggle={() => toggle(id)} renderFile={renderFile} />;
                      })}
                    </ul>
                  </div>
                ))
              : null}
          </section>
        );
      })}
    </div>
  );
}
