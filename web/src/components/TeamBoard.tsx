"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { teamBoard, waitedText } from "@/lib/mail/team-board";
import type { InboxEnquiry } from "@/lib/types";
import { cn } from "@/lib/utils";

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Per mailbox: open, late, waiting, and who is quoting what. Dark, large type: made to be left open on a second screen or a wall TV. */
export function TeamBoard({ rows, onClose }: { rows: InboxEnquiry[]; onClose: () => void }) {
  const now = useNow();
  const boxes = useMemo(() => teamBoard(rows, now), [rows, now]);
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#202731] p-6 text-[#e6ecf2]" role="dialog" aria-modal="true" aria-label="Team board" data-testid="team-board">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-2xl font-semibold">Team board</h2>
          <span className="text-sm text-[#8b97a5]">Updates by itself. Leave it open on a second screen.</span>
          <button type="button" onClick={onClose} aria-label="Close the team board" className="ml-auto rounded-md p-2 text-[#aab6c3] hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {boxes.map((b) => (
            <section key={b.mailbox} className="rounded-2xl border border-[#3a4352] p-5">
              <h3 className="text-lg font-semibold">{b.label}</h3>
              <div className="mt-3 flex gap-8">
                <div><div className="text-5xl font-semibold leading-none">{b.open}</div><div className="mt-1 text-xs text-[#8b97a5]">open</div></div>
                <div><div className={cn("text-5xl font-semibold leading-none", b.late ? "text-[#ff8a7a]" : "text-[#7fd1a5]")}>{b.late}</div><div className="mt-1 text-xs text-[#8b97a5]">late</div></div>
                <div><div className={cn("text-5xl font-semibold leading-none", b.waiting ? "text-[#f2c230]" : "text-[#7fd1a5]")}>{b.waiting}</div><div className="mt-1 text-xs text-[#8b97a5]">not opened</div></div>
                <div><div className="text-5xl font-semibold leading-none">{b.quoting}</div><div className="mt-1 text-xs text-[#8b97a5]">being quoted</div></div>
              </div>
              <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-sm">
                {b.lines.length === 0 ? <li className="text-[#7fd1a5]">Nothing waiting.</li> : null}
                {b.lines.map((l) => (
                  <li key={l.id} className="flex items-baseline gap-2">
                    <span className={l.late ? "text-[#ff8a7a]" : l.quoting ? "text-[#f2c230]" : "text-[#7fd1a5]"}>●</span>
                    <span className="min-w-0 flex-1 truncate"><b className="font-semibold">{l.who}</b> <span className="text-[#aab6c3]">{l.subject}</span></span>
                    <span className="shrink-0 text-xs text-[#8b97a5]">{l.quoting ? `${l.quoting} quoting` : `not opened ${waitedText(l.waitedMin)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Manager Home: one quiet count. The list lives on the team board, not stacked on Home. Hidden when nothing needs anyone. */
export function NeedsAttentionCard({ rows, onOpenBoard }: { rows: InboxEnquiry[]; onOpenBoard: () => void }) {
  const now = useNow(60_000);
  const boxes = useMemo(() => teamBoard(rows, now), [rows, now]);
  const late = boxes.reduce((n, b) => n + b.late, 0);
  const waiting = boxes.reduce((n, b) => n + b.waiting, 0);
  if (!late && !waiting) return null;
  return (
    <span className="inline-flex items-center gap-2" data-testid="needs-attention">
      <span className="text-[#c8c6c4]" aria-hidden>
        ·
      </span>
      <span>
        {late ? `${late} late` : ""}
        {late && waiting ? " · " : ""}
        {waiting ? `${waiting} not opened` : ""}
      </span>
      <button type="button" onClick={onOpenBoard} className="text-[#0078d4] hover:underline">
        Team board
      </button>
    </span>
  );
}
