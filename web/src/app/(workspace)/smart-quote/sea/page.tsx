"use client";

import { useState } from "react";
import { Anchor, Loader2, Zap } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { SmartQuoteResult } from "@/components/SmartQuoteResult";
import { useSeaSmartQuote } from "@/hooks/use-smart-quote";
import { SAMPLE_SEA_ENQUIRY } from "@/lib/mock/data";
import { useLiveData } from "@/lib/api";

export default function SmartQuoteSeaPage() {
  const [text, setText] = useState(SAMPLE_SEA_ENQUIRY);
  const mutation = useSeaSmartQuote();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[var(--color-atlas-sea)]">
          <Anchor className="h-5 w-5" />
          <h1 className="text-2xl font-extrabold text-[var(--color-atlas-navy)]">
            Smart Quote · Sea
          </h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {useLiveData
            ? "FCL/LCL detection and live Circulars sea tariffs."
            : "FCL/LCL detection and mock Circulars sea tariffs."}
        </p>
      </div>

      <Card className="border-sky-200/60 bg-gradient-to-br from-sky-50/80 to-white">
        <label className="block text-sm font-bold text-[var(--color-atlas-navy)]">
          Enquiry text
          <textarea
            className="mt-2 min-h-40 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => mutation.mutate(text)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Run automation
          </Button>
          <Button type="button" variant="secondary" onClick={() => setText(SAMPLE_SEA_ENQUIRY)}>
            Load sample
          </Button>
        </div>
      </Card>

      <SmartQuoteResult
        draft={mutation.data ?? null}
        error={mutation.error instanceof Error ? mutation.error.message : null}
        mode="sea"
      />
    </div>
  );
}
