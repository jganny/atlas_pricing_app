"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useLiveData } from "@/lib/api";
import { sendTestEmail } from "@/lib/firebase/rate-requests";

/** Admin: proves the pricing mailbox can send, before anyone relies on rate requests. */
export function MailTestAdmin() {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--color-atlas-navy)]">
        <Mail className="h-4 w-4" /> Test sending email
      </h2>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Rate requests go out from the pricing mailbox. Send yourself one test message to check it works before the desks use it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input className="mt-0 w-72" type="email" placeholder="your.email@company.com" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send the test to" />
        <Button
          type="button"
          disabled={busy || !to.includes("@")}
          onClick={async () => {
            if (!useLiveData) {
              toast("Demo: no email is sent.", "info");
              return;
            }
            setBusy(true);
            try {
              await sendTestEmail(to.trim());
              toast(`Test email sent to ${to.trim()}. Check the inbox (and spam).`, "success");
            } catch (e) {
              toast(e instanceof Error ? e.message : "The test couldn't be sent.", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Send test email"}
        </Button>
      </div>
    </section>
  );
}
