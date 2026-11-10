"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "@/components/Toast";
import { getFirebaseDb } from "@/lib/firebase/client";

/**
 * Admin: read enquiry emails with the cheaper AI model first. When it misses something a desk needs (the mode, the lane or the
 * cargo) the stronger model reads the email again, so a desk is never left emptier than before. Off until it has been tried on
 * real enquiries.
 */
export function CheaperReadSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getDoc(doc(getFirebaseDb(), "aiSettings", "hubExtract"))
      .then((s) => alive && setOn(s.exists() && s.data().cheapFirst === true))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, []);

  async function set(next: boolean) {
    setBusy(true);
    try {
      await setDoc(doc(getFirebaseDb(), "aiSettings", "hubExtract"), { cheapFirst: next, updatedAt: Date.now() }, { merge: true });
      setOn(next);
      toast(next ? "Emails are now read with the cheaper model first." : "Emails are read with the stronger model, as before.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (on === null) return null;
  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4" data-testid="cheaper-read-switch">
      <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Reading an enquiry email</h2>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        When someone clicks &ldquo;Quote on Air / Sea desk&rdquo;, the whole email and its attachments are read once. With this on, a cheaper model reads it first, and the stronger model reads it again only if the cheaper one missed the mode, the lane or the cargo. Try it on a few real enquiries, check the desks fill correctly, then leave it on.
      </p>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4" checked={on} disabled={busy} onChange={(e) => void set(e.target.checked)} />
        Read enquiry emails with the cheaper model first
      </label>
    </section>
  );
}
