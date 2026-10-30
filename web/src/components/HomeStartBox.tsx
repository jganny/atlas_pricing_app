"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { VertexEmblem } from "@/components/VertexEmblem";
import { VertexAskBar } from "@/components/VertexAskBar";
import { Button } from "@/components/ui";
import { useHubReader } from "@/hooks/use-hub-reader";
import { cn } from "@/lib/utils";

const ACCEPT = ".msg,.eml,.pdf,.xlsx,.xls,.csv,.docx,.txt,image/*";

/**
 * The one place to start on Home. Drop an enquiry (email, invoice, photo) or paste an email, and it is read and waits
 * in Quote hub; or type to find a quote or to quote by instruction. Nothing opens by itself.
 */
export function HomeStartBox() {
  const { items, readFiles, readText } = useHubReader();
  const [over, setOver] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState("");
  const input = useRef<HTMLInputElement>(null);

  return (
    <section
      data-testid="home-start"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void readFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn("atlas-panel space-y-2 rounded-xl p-3 md:p-4 transition", over && "ring-2 ring-sky-400 bg-sky-50/60")}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        <VertexEmblem size={22} />
        Start here
      </div>
      <VertexAskBar compact placeholder="Drop an enquiry anywhere in this box, or type: quote air BLR to DXB 120 kg · or find a customer" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Button type="button" size="sm" variant="secondary" onClick={() => input.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" /> Choose files
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowPaste((v) => !v)}>
          Paste an email
        </Button>
        <span>Dropped enquiries are read and wait in Quote hub. Nothing opens by itself.</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            void readFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </div>
      {showPaste ? (
        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            aria-label="Paste the enquiry text or email"
            placeholder="Paste the enquiry text or email here"
            className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const text = paste;
              setPaste("");
              setShowPaste(false);
              void readText(text);
            }}
          >
            Read it
          </Button>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {items.map((i) => (
            <li key={i.id} className="flex items-start gap-2">
              {i.state === "reading" ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin" /> : <span className="mt-0.5">{i.state === "done" ? "✓" : "⚠"}</span>}
              <span className={i.state === "error" ? "text-red-700" : ""}>
                <span className="font-semibold">{i.label}</span> — {i.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
