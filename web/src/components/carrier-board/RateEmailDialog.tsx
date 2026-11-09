"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, X } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useDirectory } from "@/hooks/use-atlas-data";
import { buildRateEmail, findCarrierContact, mailtoLink } from "@/lib/carriers/board";
import { useAuthStore } from "@/store/auth";

const NONE: never[] = [];

export interface RateEmailTarget {
  code: string;
  name: string;
  origin: string;
  destination: string;
  weightKg: number;
  /** Ask for every weight break (no tariff and no portal) or only this shipment's break. */
  allBreaks: boolean;
  /** Set when the portal answers up to a weight and this shipment is above it. */
  aboveKg?: number;
}

/**
 * A rate request to an airline, already written and addressed from the Directory. Nothing is sent by the app: the user
 * checks it and opens it in their own email program (or copies it).
 */
export function RateEmailDialog({ target, onClose }: { target: RateEmailTarget | null; onClose: () => void }) {
  const { data } = useDirectory();
  const contacts = data ?? NONE;
  const user = useAuthStore((s) => s.user);
  const contact = useMemo(() => (target ? findCarrierContact(contacts, target.code, target.name) : undefined), [contacts, target]);
  const draft = useMemo(
    () =>
      target
        ? buildRateEmail({ airline: target.name, origin: target.origin, destination: target.destination, weightKg: target.weightKg, allBreaks: target.allBreaks, aboveKg: target.aboveKg, contactPerson: contact?.contactPerson, senderName: user?.displayName })
        : null,
    [target, contact, user],
  );
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);
  if (!target || !draft) return null;
  // Keyed, so a new draft starts a fresh form instead of copying props into state.
  return <EmailForm key={`${target.code}|${target.origin}|${target.destination}|${target.weightKg}`} name={target.name} initialTo={contact?.email ?? ""} subject={draft.subject} body={draft.body} onClose={onClose} />;
}

function EmailForm({ name, initialTo, subject: s0, body: b0, onClose }: { name: string; initialTo: string; subject: string; body: string; onClose: () => void }) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(s0);
  const [body, setBody] = useState(b0);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast("Message copied.", "success");
    } catch {
      toast("Select the text and copy it.", "info");
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rate-email-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-2xl border border-[var(--color-border-strong)] bg-white shadow-2xl" data-testid="rate-email-dialog">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <h2 id="rate-email-title" className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
            Ask {name} for a rate
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)]">
            To (from the Directory)
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="No email on file: type one, or add it in the Directory" className="mt-1 w-full rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text)]" />
          </label>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)]">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text)]" />
          </label>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)]">
            Message
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={11} className="mt-1 w-full rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text)]" />
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">Nothing is sent from here. Check the message, then open it in your own email program. No customer name or price is included.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <Button variant="secondary" onClick={copy}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy message
          </Button>
          <a href={mailtoLink(to, subject, body)} className="inline-flex items-center justify-center rounded-lg bg-[var(--color-atlas-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-atlas-ink)]">
            <Mail className="mr-1.5 h-4 w-4" /> Open in my email
          </a>
        </div>
      </div>
    </div>
  );
}
