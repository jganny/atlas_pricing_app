"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileClock, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useMyDrafts } from "@/hooks/use-drafts";
import { deleteDraft, newDraftId, saveDraft } from "@/lib/firebase/drafts";
import { currentDeskSeatId } from "@/lib/auth/desk-seats";
import { draftAge, draftIsStale, draftTitle, type DraftMode } from "@/lib/quotes/drafts";
import type { SavedQuote } from "@/lib/types";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);
  return ref;
}

/** "Save draft": parks the desk as it is, with an optional note of what it is waiting for. */
export function SaveDraftButton({
  mode,
  build,
  step,
  draftId,
  onSaved,
}: {
  mode: DraftMode;
  build: () => { quote: SavedQuote; customer: string; origin: string; destination: string };
  step: string;
  draftId: string | null;
  onSaved: (id: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [waiting, setWaiting] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const drafts = useMyDrafts(mode);
  const existing = draftId ? drafts.find((d) => d.id === draftId) : undefined;

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      const { quote, customer, origin, destination } = build();
      const id = draftId ?? newDraftId();
      const t = draftTitle(customer, origin, destination);
      await saveDraft({
        id,
        mode,
        seat: currentDeskSeatId(user.username) ?? "",
        creator: user.username,
        customer: t.customer,
        route: t.route,
        waitingFor: waiting.trim(),
        quote,
        step,
        savedAt: Date.now(),
      });
      onSaved(id);
      setOpen(false);
      toast("Draft saved. Find it under Drafts.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save the draft. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button type="button" variant="secondary" className="h-9" data-testid="save-draft"
        onClick={() => {
          if (!open) setWaiting(existing?.waitingFor ?? "");
          setOpen((v) => !v);
        }}
      >
        <Save className="mr-1.5 h-4 w-4" />
        Save draft
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-72 space-y-2 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-lg">
          <label className="block text-xs font-bold text-[var(--color-atlas-navy)]" htmlFor={`draft-waiting-${mode}`}>
            Waiting for what? <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <input
            id={`draft-waiting-${mode}`}
            autoFocus
            className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm"
            placeholder="EK rate, co-loader quote, customer weight"
            value={waiting}
            maxLength={120}
            onChange={(e) => setWaiting(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--color-text-muted)]">A draft is not a quote. It stays with your desk.</span>
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : existing ? "Update draft" : "Save draft"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** "Drafts (n)": your desk's parked quotes for this mode, with Continue and delete. */
export function DraftsMenu({ mode, activeId }: { mode: DraftMode; activeId?: string | null }) {
  const router = useRouter();
  const drafts = useMyDrafts(mode);
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  if (!drafts.length) return null;
  return (
    <div className="relative" ref={ref}>
      <Button type="button" variant="secondary" className="h-9" data-testid="drafts-menu" onClick={() => setOpen((v) => !v)}>
        <FileClock className="mr-1.5 h-4 w-4" />
        Drafts ({drafts.length})
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-[var(--color-border)] bg-white p-2 shadow-lg" data-testid="drafts-list">
          <div className="px-1 pb-1 text-xs font-bold text-[var(--color-atlas-navy)]">Your drafts</div>
          <ul className="max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-1 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {d.customer} · {d.route}
                  </div>
                  <div className={cn("truncate text-xs", draftIsStale(d.savedAt) ? "font-semibold text-amber-700" : "text-[var(--color-text-muted)]")}>
                    {d.waitingFor ? `Waiting for: ${d.waitingFor} · ` : ""}saved {draftAge(d.savedAt)}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={d.id === activeId ? "secondary" : "primary"}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/${mode}/?draft=${encodeURIComponent(d.id)}`);
                  }}
                >
                  {d.id === activeId ? "Open" : "Continue"}
                </Button>
                <button
                  type="button"
                  aria-label={`Delete draft ${d.customer}`}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (window.confirm(`Delete the draft for ${d.customer}?`)) void deleteDraft(d.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
