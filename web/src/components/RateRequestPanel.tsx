"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useDirectory } from "@/hooks/use-atlas-data";
import { useLiveData } from "@/lib/api";
import { personDisplayName } from "@/lib/auth/desk-seats";
import { COUNTRIES, countryName, countryOfPlace } from "@/lib/directory/coverage";
import { sendRateRequests, type RateRequestResult } from "@/lib/firebase/rate-requests";
import {
  buildRequestEmail,
  newRequestRef,
  planFor,
  selectRecipients,
  type CargoFacts,
  type Candidate,
} from "@/lib/quotes/rate-request";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const NO_CONTACTS: never[] = [];
let airportCountries: Map<string, string> | null = null;

async function loadAirportCountries(): Promise<Map<string, string>> {
  if (airportCountries) return airportCountries;
  const base = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "" : "/app";
  try {
    const rows = (await (await fetch(`${base}/data/airports-slim.json`, { cache: "force-cache" })).json()) as Array<{ code: string; country?: string }>;
    airportCountries = new Map(rows.filter((r) => r.country).map((r) => [r.code.toUpperCase(), String(r.country).toUpperCase()]));
  } catch {
    airportCountries = new Map();
  }
  return airportCountries;
}

/**
 * Ask the right agents / airlines / liners / coloaders for rates: the app picks them from the Directory, writes the
 * message, and the user checks the list and presses Send once. The customer's name and prices are never included.
 */
export function RateRequestPanel({
  mode,
  direction,
  incoterm,
  origin,
  destination,
  cargo,
  onClose,
}: {
  mode: "air" | "sea";
  direction: "import" | "export";
  incoterm: string;
  origin: string;
  destination: string;
  cargo: CargoFacts;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const { data: contactsData } = useDirectory();
  const contacts = contactsData ?? NO_CONTACTS;
  const [airports, setAirports] = useState<Map<string, string>>(new Map());
  const [originOverride, setOriginOverride] = useState("");
  const [destOverride, setDestOverride] = useState("");
  const [ref] = useState(() => newRequestRef());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showUnsure, setShowUnsure] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RateRequestResult | null>(null);

  useEffect(() => {
    void loadAirportCountries().then(setAirports);
  }, []);

  const originCountry = originOverride || countryOfPlace(origin, { airports });
  const destCountry = destOverride || countryOfPlace(destination, { airports });
  const ctx = useMemo(() => ({ mode, direction, incoterm, originCountry, destCountry }), [mode, direction, incoterm, originCountry, destCountry]);
  const plan = useMemo(() => planFor(ctx), [ctx]);
  const selection = useMemo(() => selectRecipients(plan, ctx, contacts), [plan, ctx, contacts]);

  // Pre-select everyone who matched whenever the list changes; the user can untick.
  const matchedKey = selection.matched.map((c) => c.id).join(",");
  useEffect(() => {
    setChecked(new Set(selection.matched.map((c) => c.id)));
  }, [matchedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const senderName = personDisplayName(user?.username, user?.displayName);
  useEffect(() => {
    const email = buildRequestEmail({
      ...ctx,
      ref,
      originLabel: origin || "—",
      destLabel: destination || "—",
      cargo,
      senderName,
    });
    setSubject(email.subject);
    setBody(email.body);
    // The text is generated once per lane/terms; after that it belongs to the user to edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, direction, incoterm, origin, destination, senderName]);

  // Imports ask the origin country's agents; everything else is decided by the destination.
  const countryRole = plan.kind === "agents" && direction === "import" ? "origin" : "destination";
  const everyone: Candidate[] = [...selection.matched, ...(showUnsure ? selection.unsure : [])];
  const chosen = everyone.filter((c) => checked.has(c.id));

  function toggle(id: string) {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (!chosen.length) {
      toast("Choose at least one contact.", "error");
      return;
    }
    if (!useLiveData) {
      setResult({ ref, sent: chosen.length, results: chosen.map((c) => ({ id: c.id, name: c.name, status: "sent" as const, note: "Demo: nothing was actually sent" })) });
      return;
    }
    setSending(true);
    try {
      const res = await sendRateRequests({
        ref,
        subject,
        body,
        recipients: chosen.map((c) => ({ id: c.id, name: c.name, email: c.email })),
        senderName,
        mode,
        direction,
        incoterm,
        origin,
        destination,
      });
      setResult(res);
      toast(`Rate request sent to ${res.sent} contact${res.sent === 1 ? "" : "s"}.`, res.sent ? "success" : "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send the request.", "error");
    } finally {
      setSending(false);
    }
  }

  const CountryPick = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <label className="flex items-center gap-2 text-xs font-semibold">
      {label}
      <select className="rounded border px-2 py-1 text-sm font-normal" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose country</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Request rates">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-[var(--color-atlas-navy)]">Request rates</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Reference {ref}. Replies come to the pricing mailbox with this reference in the subject.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className={cn("rounded-lg px-3 py-2 text-sm", plan.kind === "none" ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-900")}>{plan.reason}</p>

          {plan.kind !== "none" && !(plan.country) ? (
            <div className="flex flex-wrap gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-xs">The {countryRole === "origin" ? "origin" : "destination"} country couldn&apos;t be read from the place. Choose it:</span>
              {countryRole === "origin" ? (
                <CountryPick label="Origin" value={originOverride} onChange={setOriginOverride} />
              ) : (
                <CountryPick label="Destination" value={destOverride} onChange={setDestOverride} />
              )}
            </div>
          ) : null}

          {plan.kind !== "none" ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <b>
                  {chosen.length} of {selection.matched.length} contact{selection.matched.length === 1 ? "" : "s"} selected
                </b>
                <span className="text-[var(--color-text-muted)]">
                  {selection.skipped.suspended ? `${selection.skipped.suspended} suspended skipped · ` : ""}
                  {selection.skipped.noEmail ? `${selection.skipped.noEmail} without email skipped` : ""}
                </span>
              </div>
              <ul className="max-h-56 divide-y divide-[var(--color-border)] overflow-y-auto rounded-lg border border-[var(--color-border)] text-sm">
                {everyone.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
                    No matching contacts in the Directory{plan.country ? ` for ${countryName(plan.country)}` : ""}. {plan.kind === "vendors" ? "Fill “Countries served” on the vendors." : ""}
                  </li>
                ) : null}
                {everyone.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                      <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {c.name}
                          {c.rating ? <span className="ml-1 text-amber-600">{"★".repeat(Math.min(5, c.rating))}</span> : null}
                        </span>
                        <span className="block truncate text-xs text-[var(--color-text-muted)]">
                          {c.kind} · {c.note} · {c.email}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {selection.unsure.length ? (
                <button type="button" className="mt-1 text-xs font-semibold text-sky-800 underline" onClick={() => setShowUnsure((v) => !v)}>
                  {showUnsure ? "Hide" : `Show ${selection.unsure.length} more with no country on record`}
                </button>
              ) : null}
              {selection.overCap ? <p className="mt-1 text-xs text-amber-800">{selection.overCap} more matched; only the 40 best-rated are listed.</p> : null}
            </div>
          ) : null}

          {plan.kind !== "none" ? (
            <div className="space-y-2">
              <input className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
              <textarea className="h-48 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
              <p className="text-[11px] text-[var(--color-text-muted)]">Each contact gets their own email; nobody sees the others. The customer&apos;s name and your prices are never included.</p>
            </div>
          ) : null}

          {result ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4" /> Sent to {result.sent} of {result.results.length}
              </p>
              <ul className="mt-1 text-xs">
                {result.results.filter((r) => r.status !== "sent").map((r) => (
                  <li key={r.id}>
                    {r.name}: {r.status}
                    {r.note ? ` — ${r.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {plan.kind !== "none" && !result ? (
            <Button type="button" disabled={sending || !chosen.length} onClick={() => void send()} data-testid="rate-request-send">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send to {chosen.length} contact{chosen.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
