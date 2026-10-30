"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useHubReader } from "@/hooks/use-hub-reader";
import { useLiveData } from "@/lib/api";
import { hasInstruction, parseInstruction } from "@/lib/hub/instruction";

const ACCEPT = ".msg,.eml,.pdf,.xlsx,.xls,.csv,.docx,.txt,image/*";

/** Drop Outlook emails, invoices, packing lists or photos: each job is read and filed as a ready-filled draft. */
export function QuoteHubDrop() {
  const { items, readFiles, readText } = useHubReader();
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [instruction, setInstruction] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    // What was typed applies to this drop only; the box is emptied so it never leaks onto the next enquiry.
    const typed = instruction.trim();
    if (useLiveData) setInstruction("");
    await readFiles(files, typed);
  }

  async function handlePaste() {
    const text = paste.trim();
    if (!text) return;
    const typed = instruction.trim();
    if (useLiveData) {
      setPaste("");
      setShowPaste(false);
      setInstruction("");
    }
    await readText(text, typed);
  }

  return (
    <Card className="atlas-frost space-y-3 rounded-2xl bg-white/70">
      <div>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          aria-label="What should Vertex do with the next drop"
          placeholder="Optional: tell Vertex what to do — e.g. use BLR - EK rates for +100, add 10/kg, quote in USD"
          className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
          data-testid="hub-instruction"
        />
        {instruction.trim() ? (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            {hasInstruction(parseInstruction(instruction))
              ? "Understood — it is applied when you open the job."
              : useLiveData
                ? "Vertex will read this in plain words when you open the job."
                : "Not understood yet — add a carrier (EK), a break (+100) or a margin (10/kg or 10%)."}
          </p>
        ) : null}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handleFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          over ? "border-[var(--color-atlas-sky)] bg-sky-50" : "border-[var(--color-border)] bg-white/60"
        }`}
        data-testid="hub-dropzone"
      >
        <Upload className="h-6 w-6 text-[var(--color-atlas-navy)]" />
        <div className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
          Drop Outlook emails (.msg / .eml), invoices, packing lists or photos
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          Keep dropping — each one is read and waits below. Nothing opens by itself.
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" onClick={() => input.current?.click()}>
            Choose files
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowPaste((v) => !v)}>
            Paste text instead
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handleFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
      </div>

      {showPaste ? (
        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            placeholder="Paste the enquiry text or email here"
            className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm"
          />
          <Button type="button" size="sm" onClick={() => void handlePaste()}>
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
    </Card>
  );
}
