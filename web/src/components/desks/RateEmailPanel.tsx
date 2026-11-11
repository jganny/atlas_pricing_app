"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mail, Upload } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui";
import { toast } from "@/components/Toast";
import { readRateEmails } from "@/lib/firebase/rate-email";
import { fetchThread } from "@/lib/firebase/threads";
import { ALL_CURRENCIES, currencyLabel } from "@/lib/desk/currencies";
import { useAiSwitches } from "@/lib/firebase/ai-switches";
import { aiAllowed, aiOffMessage } from "@/lib/ai/ai-switches";
import { parseEmailFile } from "@/lib/hub/email-file";
import type { AirlineOption, LinerOption } from "@/lib/pricing/carrier-options";
import { BREAK_LABELS, RATE_EMAILS_KEY, blockers, currencyClash, readToAirOption, readToLinerOption, type MarginInput, type PendingRateEmail, type RateRead } from "@/lib/rates/rate-email";
import { cn } from "@/lib/utils";

const CURRENCY_CHOICES = ALL_CURRENCIES;

interface Item {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  text: string;
  read?: RateRead;
  currency: string;
  airlineName: string;
  agentName: string;
  isAgent: boolean;
  added: boolean;
}

/** Emails left by "Send to desk as rates" in the Inbox conversation: taken once, when the panel opens. */
function takePending(): PendingRateEmail[] {
  try {
    const raw = window.sessionStorage.getItem(RATE_EMAILS_KEY);
    if (!raw) return [];
    window.sessionStorage.removeItem(RATE_EMAILS_KEY);
    const list = JSON.parse(raw) as PendingRateEmail[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const newItem = (e: Omit<PendingRateEmail, "id"> & { id?: string }, isAgent: boolean): Item => ({
  id: e.id ?? `re_${Math.random().toString(36).slice(2, 9)}`,
  fromName: e.fromName,
  fromEmail: e.fromEmail,
  subject: e.subject,
  text: e.text,
  // Already read by the server: shown straight away, ready to add.
  read: e.read,
  currency: e.read?.currency ?? "",
  airlineName: e.read?.airlineName ?? "",
  agentName: e.read?.vendor ?? "",
  isAgent,
  added: false,
});

/**
 * Add the rates a vendor, an airline's sales agent or an overseas agent sent by email. Upload the emails (or paste the text); AI copies the rates
 * (about ₹0.30 or less per email, only when you press the button); fixed rules settle the currency and the airline and say what still needs you.
 * The vendor's rate is the buy rate: you add your margin, choose which options go to the customer, and an agent's name never reaches the customer.
 */
export function RateEmailPanel({
  mode,
  module,
  origin,
  destination,
  weightKg,
  laneId,
  inboxId,
  onAdd,
}: {
  mode: "air" | "sea";
  module: "import" | "export";
  origin: string;
  destination: string;
  weightKg?: number;
  laneId?: string;
  /** The Inbox enquiry this quote answers: the rates already read from its conversation appear here by themselves. */
  inboxId?: string;
  onAdd: (options: Array<AirlineOption | LinerOption>, currency: string) => void;
}) {
  const switches = useAiSwitches();
  const aiOn = aiAllowed(switches, "rateReplies");
  const [items, setItems] = useState<Item[]>(() => (typeof window === "undefined" ? [] : takePending().map((p) => newItem(p, module === "import"))));
  const [open, setOpen] = useState<boolean>(() => items.length > 0);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [marginMode, setMarginMode] = useState<"perUnit" | "percent">("perUnit");
  const [marginText, setMarginText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addedIds = useRef<Set<string>>(new Set());

  // The conversation of the enquiry: replies the server has already read appear here by themselves, and new ones as they arrive.
  useEffect(() => {
    if (!inboxId) return;
    let alive = true;
    const load = async () => {
      try {
        const t = await fetchThread(inboxId);
        if (!alive) return;
        const fresh = t.members.filter((m) => m.role === "reply" && m.rateState === "read" && m.rates && m.rates.hasRates && !addedIds.current.has(m.id));
        if (!fresh.length) return;
        fresh.forEach((m) => addedIds.current.add(m.id));
        setItems((prev) => [
          ...prev,
          ...fresh.filter((m) => !prev.some((p) => p.id === m.id)).map((m) => newItem({ id: m.id, fromName: m.who, fromEmail: m.email, subject: m.subject, text: "", read: m.rates ?? undefined }, module === "import")),
        ]);
        setOpen(true);
      } catch {
        /* the conversation is not available: uploading still works */
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [inboxId, module]);

  const marginNum = marginText.trim() === "" ? null : Number(marginText);
  const margin: MarginInput | null = marginNum === null || !Number.isFinite(marginNum) || marginNum < 0 ? null : marginMode === "percent" ? { mode: "percent", percent: marginNum } : { mode: "perUnit", amount: marginNum };
  const unit = mode === "air" ? "per kg" : "per container";

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added: Item[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        const mail = await parseEmailFile(f.name, await f.arrayBuffer());
        added.push(newItem({ fromName: mail.fromName, fromEmail: mail.fromEmail, subject: mail.subject, text: mail.bodyText }, module === "import"));
      } catch {
        toast(`${f.name} could not be opened. Save the email as .eml or .msg and try again.`, "error");
      }
    }
    if (added.length) {
      setItems((prev) => [...prev, ...added]);
      void readItems(added);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function addPasted() {
    const text = paste.trim();
    if (text.length < 5) return;
    const item = newItem({ fromName: "", fromEmail: "", subject: "Pasted text", text }, module === "import");
    setItems((prev) => [...prev, item]);
    setPaste("");
    void readItems([item]);
  }

  /** Reads emails that have not been read yet, by themselves the moment they are added (no button). */
  async function readItems(list: Item[]) {
    const todo = list.filter((i) => !i.read && i.text.trim().length >= 5);
    if (!todo.length) return;
    if (!aiOn) return;
    setBusy(true);
    try {
      const reads = await readRateEmails({ mode, origin, destination, weightKg, emails: todo.map((i) => ({ fromName: i.fromName, fromEmail: i.fromEmail, subject: i.subject, text: i.text })) });
      setItems((prev) =>
        prev.map((i) => {
          const k = todo.findIndex((t) => t.id === i.id);
          const r = k >= 0 ? reads[k] : undefined;
          return r ? { ...i, read: r, currency: r.currency, airlineName: r.airlineName, agentName: r.vendor } : i;
        }),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "The emails could not be read. Try again, or type the rates in.", "error");
    } finally {
      setBusy(false);
    }
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function build(i: Item): AirlineOption | LinerOption | null {
    if (!i.read || !margin) return null;
    const c = { currency: i.currency, airlineName: i.airlineName, agentName: i.agentName, isAgent: i.isAgent, margin, laneId, carrierName: i.airlineName };
    return mode === "air" ? readToAirOption(i.read, c) : readToLinerOption(i.read, { ...c, carrierName: i.airlineName || `Agent rate ${items.indexOf(i) + 1}` });
  }

  function addOne(i: Item) {
    const opt = build(i);
    if (!opt) return;
    onAdd([opt], i.currency || i.read?.currency || "");
    update(i.id, { added: true });
    toast("Added to the desk. Check the sell rates, then choose what goes to the customer.", "success");
  }

  const readAll = () => readItems(items);

  // Emails kept from the Inbox conversation that were not read yet are read as soon as the panel opens.
  useEffect(() => {
    const waiting = items.filter((i) => !i.read);
    if (!waiting.length) return;
    const t = window.setTimeout(() => void readItems(waiting), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ready = items.filter((i) => i.read && !i.added && blockers(i.read, { currency: i.currency, airlineName: i.airlineName }).length === 0);
  const clash = currencyClash(ready.map((i) => ({ currency: i.currency || i.read?.currency || "" })));
  function addAllReady() {
    if (clash || !margin) return;
    const opts = ready.map(build).filter((o): o is AirlineOption | LinerOption => Boolean(o));
    if (!opts.length) return;
    onAdd(opts, ready[0].currency || ready[0].read?.currency || "");
    setItems((prev) => prev.map((i) => (ready.some((r) => r.id === i.id) ? { ...i, added: true } : i)));
    toast(`${opts.length} option${opts.length === 1 ? "" : "s"} added to the desk.`, "success");
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50/60 px-4 py-3 text-left text-sm font-semibold text-sky-900 hover:bg-sky-50" data-testid="rate-email-open">
        <Mail className="h-4 w-4" /> Add rates from emails (vendors, airline agents, overseas agents)
        <span className="ml-auto text-xs font-normal text-sky-800">upload the emails, the rates are read for you</span>
      </button>
    );
  }

  return (
    <Card className="space-y-3 border-sky-200 p-4" data-testid="rate-email-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-extrabold text-[var(--color-atlas-navy)]">Rates from emails</h3>
        <span className="text-xs text-slate-500"><b className="text-sky-700">AI</b> reads each email by itself, once, about ₹0.30 or less</span>
        <button type="button" className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => setOpen(false)}>Hide</button>
      </div>
      <p className="text-xs text-slate-600">
        Upload as many emails as you have, from one vendor or several agents. Each becomes its own option on the desk, with your margin added. {module === "import" ? "An agent's name stays inside the company: the customer sees only a neutral label." : ""} You choose which options are sent to the customer.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} id="rate-email-files" type="file" accept=".eml,.msg" multiple className="hidden" onChange={(e) => void addFiles(e.target.files)} data-testid="rate-email-file" />
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Upload emails (.eml, .msg)
        </Button>
        <span className="text-xs text-slate-500">or paste the text of an email or a message:</span>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <textarea id="rate-email-paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={2} placeholder="For example: +500kg=730 allin NH" className="min-w-[16rem] flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" aria-label="Paste an email or message with rates" />
        <Button type="button" variant="secondary" onClick={addPasted} disabled={paste.trim().length < 5}>Add text</Button>
      </div>

      {items.length ? (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div>
              <Label>My margin on every rate</Label>
              <div className="mt-1 flex items-center gap-1">
                <select aria-label="Margin type" value={marginMode} onChange={(e) => setMarginMode(e.target.value as "perUnit" | "percent")} className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-sm">
                  <option value="perUnit">Amount {unit}</option>
                  <option value="percent">Percent</option>
                </select>
                <Input id="rate-email-margin" className="mt-0 w-28" inputMode="decimal" value={marginText} onChange={(e) => setMarginText(e.target.value)} placeholder="0" aria-label="Margin" data-testid="rate-email-margin" />
              </div>
            </div>
            <p className="max-w-md text-xs text-slate-600">Enter it before adding (0 is allowed). The vendor&apos;s rate is your cost; the margin makes the sell rate. You can still change each sell rate on the desk.</p>
            <span className="flex-1" />
            {!aiOn ? <span className="text-xs font-semibold text-amber-800">{aiOffMessage(switches, "rateReplies")}</span> : null}
            <Button type="button" onClick={() => void readAll()} disabled={busy || !aiOn || !items.some((i) => !i.read)} data-testid="rate-email-read">
              {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Reading…</> : `Read again (${items.filter((i) => !i.read).length})`}
            </Button>
          </div>

          <ul className="m-0 list-none space-y-3 p-0">
            {items.map((i, idx) => {
              const r = i.read;
              const stop = r ? blockers(r, { currency: i.currency, airlineName: i.airlineName }) : [];
              return (
                <li key={i.id} className={cn("rounded-xl border p-3", i.added ? "border-emerald-200 bg-emerald-50/50" : "border-[var(--color-border)] bg-white")} data-testid="rate-email-item">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <b className="text-sm text-slate-900">{idx + 1}. {i.fromName || i.fromEmail || "Pasted text"}</b>
                    <span className="truncate text-slate-500">{i.subject}</span>
                    <span className="ml-auto">
                      {i.added ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">Added to the desk</span> : r ? null : <span className="text-slate-500">Not read yet</span>}
                    </span>
                    {!r && !i.added ? <button type="button" className="font-semibold text-slate-500 hover:text-red-700" onClick={() => setItems((p) => p.filter((x) => x.id !== i.id))}>Remove</button> : null}
                  </div>
                  {r && !i.added ? (
                    <div className="mt-2 space-y-2">
                      {r.error ? <p className="text-xs text-amber-800">{r.error}</p> : null}
                      <div className="grid gap-2 sm:grid-cols-4">
                        <div>
                          <Label>{module === "import" ? "Agent (stays inside)" : "Vendor"}</Label>
                          <Input value={i.agentName} onChange={(e) => update(i.id, { agentName: e.target.value })} className="mt-1" aria-label="Agent or vendor name" />
                        </div>
                        {mode === "air" ? (
                          <div>
                            <Label>Airline{r.needsCheck.includes("airline") && !i.airlineName ? <span className="ml-1 text-amber-700">to confirm</span> : null}</Label>
                            <Input value={i.airlineName} onChange={(e) => update(i.id, { airlineName: e.target.value })} className={cn("mt-1", !i.airlineName && "border-amber-400")} placeholder={r.airlineCode ? `Code ${r.airlineCode} not found` : "Name the airline"} aria-label="Airline" />
                          </div>
                        ) : (
                          <div>
                            <Label>Liner / coloader</Label>
                            <Input value={i.airlineName} onChange={(e) => update(i.id, { airlineName: e.target.value })} className="mt-1" placeholder={`Agent rate ${idx + 1}`} aria-label="Liner or coloader" />
                          </div>
                        )}
                        <div>
                          <Label>Currency{r.currencyAssumed && i.currency === r.currency ? <span className="ml-1 text-amber-700">assumed: sent within India</span> : null}</Label>
                          <select aria-label="Currency" value={i.currency} onChange={(e) => update(i.id, { currency: e.target.value })} className={cn("mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm", i.currency ? "border-[var(--color-border)]" : "border-amber-400")}>
                            <option value="">Choose…</option>
                            {CURRENCY_CHOICES.map((c) => <option key={c} value={c}>{currencyLabel(c)}</option>)}
                          </select>
                        </div>
                        <label className="flex items-end gap-2 pb-2 text-sm">
                          <input type="checkbox" className="h-4 w-4" checked={i.isAgent} onChange={(e) => update(i.id, { isAgent: e.target.checked })} data-testid="rate-email-agent" />
                          <span>Rate from an agent<span className="block text-xs text-slate-500">name never reaches the customer</span></span>
                        </label>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <tbody>
                            {mode === "air"
                              ? (Object.entries(r.breaks) as Array<[keyof typeof BREAK_LABELS, number]>).map(([k, v]) => (
                                  <tr key={k} className="border-t border-slate-100"><td className="py-1 pr-3 text-slate-600">{BREAK_LABELS[k]}</td><td className="py-1 font-semibold tabular-nums">{v}{k === "min" ? " total" : " per kg"}</td></tr>
                                ))
                              : [...r.containers.map((c) => [c.type || c.label || "Container (type not clear)", `${c.rate} per container`] as const), ...(r.lclPerCbm ? [["LCL", `${r.lclPerCbm} per cbm`] as const] : [])].map(([k, v]) => (
                                  <tr key={k} className="border-t border-slate-100"><td className="py-1 pr-3 text-slate-600">{k}</td><td className="py-1 font-semibold tabular-nums">{v}</td></tr>
                                ))}
                            {r.basis ? <tr className="border-t border-slate-100"><td className="py-1 pr-3 text-slate-600">Basis</td><td className="py-1">{r.basis === "all-in" ? "All-in (surcharges included)" : "Freight only"}</td></tr> : null}
                            {r.validity ? <tr className="border-t border-slate-100"><td className="py-1 pr-3 text-slate-600">Valid</td><td className="py-1">{r.validity}</td></tr> : null}
                            {r.remarks ? <tr className="border-t border-slate-100"><td className="py-1 pr-3 text-slate-600">Note</td><td className="py-1">{r.remarks}</td></tr> : null}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {stop.length ? <span className="text-xs font-semibold text-amber-800">{stop.join(" ")}</span> : !margin ? <span className="text-xs font-semibold text-amber-800">Enter your margin above (0 is allowed).</span> : null}
                        <span className="flex-1" />
                        <Button type="button" onClick={() => addOne(i)} disabled={stop.length > 0 || !margin} data-testid="rate-email-add">Add to the desk</Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {ready.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {clash ? <span className="text-xs font-semibold text-amber-800">{clash}</span> : null}
              <span className="flex-1" />
              <Button type="button" onClick={addAllReady} disabled={Boolean(clash) || !margin}>Add all {ready.length} that are ready</Button>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
