"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { toast } from "@/components/Toast";
import { draftEnquiryReply, DraftError, type ReplyDraft } from "@/lib/ai/draft-reply";
import {
  basicReplyDraft,
  mailtoHref,
  replySubject,
  senderEmail,
  understandEnquiry,
} from "@/lib/mail/reply-draft";
import { IS_DEMO_BUILD } from "@/lib/demo-mode";
import type { InboxEnquiry } from "@/lib/types";

type Source = "ai" | "template";

export function EnquiryReplyDrafter({
  item,
  mode,
  signOff,
}: {
  item: InboxEnquiry;
  mode: "air" | "sea";
  signOff: string;
}) {
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [source, setSource] = useState<Source>("ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { understood, missing } = understandEnquiry(item, mode);
  const to = senderEmail(item.from);

  function applyTemplate() {
    setDraft(basicReplyDraft(item, mode, signOff));
    setSource("template");
    setError(null);
  }

  async function generate() {
    setError(null);
    // The public demo has no AI backend — show a sample reply built from the same enquiry.
    if (IS_DEMO_BUILD) {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 700));
      applyTemplate();
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await draftEnquiryReply(item, mode, signOff);
      setDraft({ subject: result.subject || replySubject(item.subject), body: result.body });
      setSource("ai");
    } catch (e) {
      setError(e instanceof DraftError ? e.message : "Couldn't draft a reply.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      toast("Draft copied", "success");
    } catch {
      toast("Couldn't copy — select the text and copy it", "error");
    }
  }

  return (
    <Card className="space-y-3 border-sky-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-atlas-navy)]">
          <Sparkles className="h-4 w-4 text-sky-700" />
          Reply to this enquiry
        </h3>
        {!draft ? (
          <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => void generate()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Draft with AI
          </Button>
        ) : null}
      </div>

      <div>
        <div className="mb-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">What Atlas understood</div>
        <div className="flex flex-wrap gap-1.5">
          {understood.map((u) => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> {u}
            </span>
          ))}
          {missing.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3 w-3" /> {m} missing
            </span>
          ))}
        </div>
      </div>

      {error ? (
        <div className="space-y-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <div>{error}</div>
          <Button type="button" variant="secondary" size="sm" onClick={applyTemplate}>
            Use a basic template instead
          </Button>
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {source === "ai" ? "Draft — read before you send" : IS_DEMO_BUILD ? "Sample draft — read before you send" : "Basic template — read before you send"}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">To: {to || "— no address found —"}</span>
          </div>
          <Input
            aria-label="Reply subject"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
          <Textarea
            aria-label="Reply body"
            rows={11}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            The draft has <strong>no prices</strong> — it acknowledges the enquiry and asks for what is missing.
            Edit anything before using it; Atlas never sends it for you.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void generate()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
                <Copy className="h-3.5 w-3.5" /> Copy text
              </Button>
              {to ? (
                <a
                  href={mailtoHref(to, draft.subject, draft.body)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-atlas-navy)] px-2.5 text-xs font-semibold text-white hover:bg-[var(--color-atlas-ink)]"
                >
                  <Mail className="h-3.5 w-3.5" /> Open in my mail app
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
