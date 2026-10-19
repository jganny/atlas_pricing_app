/**
 * Rate requests: who should be asked for rates on an enquiry, and what the email says.
 *
 *  - Import by Air or Sea under FOB / EXW / FCA          → overseas agents in the ORIGIN country
 *  - Export under CIF / DDP / DDU / DAP                  → overseas agents in the DESTINATION country
 *  - Export under EXW / FOB / FCA                        → airlines, liners and coloaders that serve the lane
 * Anything else gets no automatic request. Suspended contacts and contacts with no email are never picked.
 */
import { contactCountries, countryName, vendorKind, type VendorKind } from "@/lib/directory/coverage";
import type { DirectoryContact } from "@/lib/types";

export const MAX_AUTO_RECIPIENTS = 40;

const AGENT_FROM_ORIGIN = new Set(["FOB", "EXW", "FCA"]);
const AGENT_FROM_DESTINATION = new Set(["CIF", "DDP", "DDU", "DAP"]);
const VENDOR_EXPORT = new Set(["EXW", "FOB", "FCA"]);

export interface RequestContext {
  mode: "air" | "sea";
  direction: "import" | "export";
  incoterm: string;
  originCountry?: string;
  destCountry?: string;
}

export type RequestPlan =
  | { kind: "agents"; country?: string; reason: string }
  | { kind: "vendors"; country?: string; reason: string }
  | { kind: "none"; reason: string };

export function planFor(ctx: RequestContext): RequestPlan {
  const term = ctx.incoterm.trim().toUpperCase();
  if (ctx.direction === "import" && AGENT_FROM_ORIGIN.has(term)) {
    return { kind: "agents", country: ctx.originCountry, reason: `Import under ${term}: ask the overseas agents in ${ctx.originCountry ? countryName(ctx.originCountry) : "the origin country"}.` };
  }
  if (ctx.direction === "export" && AGENT_FROM_DESTINATION.has(term)) {
    return { kind: "agents", country: ctx.destCountry, reason: `Export under ${term}: ask the agents in ${ctx.destCountry ? countryName(ctx.destCountry) : "the destination country"}.` };
  }
  if (ctx.direction === "export" && VENDOR_EXPORT.has(term)) {
    const who = ctx.mode === "air" ? "airlines and coloaders" : "liners and coloaders";
    return { kind: "vendors", country: ctx.destCountry, reason: `Export under ${term}: ask the ${who} that serve ${ctx.destCountry ? countryName(ctx.destCountry) : "this lane"}.` };
  }
  if (!term) return { kind: "none", reason: "Choose the Import/Export and the incoterm to see who to ask." };
  return { kind: "none", reason: `No automatic request for ${ctx.direction} under ${term}.` };
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  contactPerson: string;
  kind: VendorKind | "agent";
  note: string;
  rating?: number;
}

export interface Selection {
  /** Serve the lane/country — selected by default. */
  matched: Candidate[];
  /** Right kind of contact but no country on record — shown, not selected. */
  unsure: Candidate[];
  skipped: { suspended: number; noEmail: number };
  /** Matched contacts beyond the per-request cap, left out. */
  overCap: number;
}

const isAgency = (c: DirectoryContact) => (c.category || "agency").toLowerCase() === "agency";
const hasEmail = (c: DirectoryContact) => /@/.test(c.email || "");

function candidate(c: DirectoryContact, kind: Candidate["kind"], note: string): Candidate {
  return { id: c.id, name: c.name, email: c.email || "", contactPerson: c.contactPerson || "", kind, note, rating: c.rating };
}

const byRating = (a: Candidate, b: Candidate) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name);

export function selectRecipients(plan: RequestPlan, ctx: RequestContext, contacts: DirectoryContact[]): Selection {
  const out: Selection = { matched: [], unsure: [], skipped: { suspended: 0, noEmail: 0 }, overCap: 0 };
  if (plan.kind === "none") return out;
  const target = plan.country;
  const wantKinds: VendorKind[] = ctx.mode === "air" ? ["airline", "coloader"] : ["liner", "coloader"];

  for (const c of contacts) {
    const relevant = plan.kind === "agents" ? isAgency(c) : !isAgency(c) && wantKinds.includes(vendorKind(c));
    if (!relevant) continue;
    if (c.suspended) {
      out.skipped.suspended += 1;
      continue;
    }
    if (!hasEmail(c)) {
      out.skipped.noEmail += 1;
      continue;
    }
    const countries = contactCountries(c, plan.kind === "vendors");
    const kind: Candidate["kind"] = plan.kind === "agents" ? "agent" : vendorKind(c);
    if (!target) {
      // The country of the lane isn't known yet — nothing can be matched.
      out.unsure.push(candidate(c, kind, "Country of the lane not set"));
    } else if (countries.includes(target)) {
      out.matched.push(candidate(c, kind, `Serves ${countryName(target)}`));
    } else if (plan.kind === "vendors" && countries.length === 0) {
      out.unsure.push(candidate(c, kind, "No countries on record"));
    }
  }
  out.matched.sort(byRating);
  out.unsure.sort(byRating);
  if (out.matched.length > MAX_AUTO_RECIPIENTS) {
    out.overCap = out.matched.length - MAX_AUTO_RECIPIENTS;
    out.matched = out.matched.slice(0, MAX_AUTO_RECIPIENTS);
  }
  return out;
}

/** A short reference that goes in the subject so replies can be matched back to this request. */
export function newRequestRef(now = Date.now()): string {
  return `RQ-${now.toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}

export interface CargoFacts {
  pieces?: number;
  grossKg?: number;
  volumeCbm?: number;
  chargeableKg?: number;
  containers?: Array<{ type: string; qty: number }>;
  commodity?: string;
  readiness?: string;
}

export interface EmailInput extends RequestContext {
  ref: string;
  originLabel: string;
  destLabel: string;
  cargo: CargoFacts;
  senderName: string;
}

/** Subject and body. Never includes the customer's name or any price. */
export function buildRequestEmail(i: EmailInput): { subject: string; body: string } {
  const modeWord = i.mode === "air" ? "Air" : "Sea";
  const dir = i.direction === "export" ? "export" : "import";
  const subject = `Rate request | ${modeWord} ${dir} | ${i.originLabel} to ${i.destLabel} | ${i.incoterm.toUpperCase()} | ${i.ref}`;
  const lines: string[] = ["Dear Partner,", "", `Please share your best ${modeWord.toLowerCase()} freight rate for the following shipment:`, ""];
  lines.push(`Origin: ${i.originLabel}`, `Destination: ${i.destLabel}`, `Terms: ${i.incoterm.toUpperCase()}`);
  const c = i.cargo;
  if (c.commodity) lines.push(`Commodity: ${c.commodity}`);
  if (c.containers?.length) lines.push(`Containers: ${c.containers.map((x) => `${x.qty} x ${x.type}`).join(", ")}`);
  if (c.pieces) lines.push(`Packages: ${c.pieces}`);
  if (c.grossKg) lines.push(`Gross weight: ${round(c.grossKg)} kg`);
  if (c.volumeCbm) lines.push(`Volume: ${round(c.volumeCbm)} CBM`);
  if (c.chargeableKg && i.mode === "air") lines.push(`Chargeable weight: ${round(c.chargeableKg)} kg`);
  if (c.readiness) lines.push(`Cargo readiness: ${c.readiness}`);
  lines.push("", "Please reply to this email with your rate, all-in charges, transit time and validity. Kindly keep the reference in the subject.", "", "Thanks & regards,", i.senderName, "Atlas Logistics");
  return { subject, body: lines.join("\n") };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Rate requests are switched off for everyone but the main administrator while the feature is on hold
 * (sending from the pricing mailbox has not been verified). Widen this when the feature is resumed.
 */
export function canUseRateRequests(username: string | undefined | null): boolean {
  return (username || "").toLowerCase() === "ganny";
}
