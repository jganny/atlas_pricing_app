/**
 * Cleans what the AI returned: fixes types, decides Import/Export from the countries when they are
 * clear, drops a colleague's address as the "sender", and tidies the customer against the agents list.
 * Pure, so every rule is tested.
 */
import { normalizeAgentName, sameAgent } from "@/lib/quotes/agent-import";
import { OWN_EMAIL_DOMAINS } from "@/lib/quotes/team-roles";
import type { HubDirection, HubExtraction, HubMode, HubPackage, HubPlace } from "./types";

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "outlook.com", "hotmail.com", "live.com",
  "rediffmail.com", "icloud.com", "proton.me", "protonmail.com", "aol.com", "msn.com",
]);

const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function emailDomain(email: string): string {
  const m = /@([a-z0-9.-]+\.[a-z]{2,})\s*>?\s*$/i.exec(email.trim());
  return m ? m[1].toLowerCase() : "";
}

export function isInternalEmail(email: string, ownDomains: string[] = OWN_EMAIL_DOMAINS): boolean {
  const d = emailDomain(email);
  if (!d) return false;
  return ownDomains.some((o) => d === o.toLowerCase() || d.endsWith(`.${o.toLowerCase()}`));
}

/** "ops@abc-logistics.co.uk" → "Abc Logistics"; free mail addresses give nothing. */
export function companyFromDomain(email: string): string {
  const d = emailDomain(email);
  if (!d || FREE_MAIL.has(d)) return "";
  const host = d.split(".");
  // drop country-style endings like co.uk / com.sg
  const core = host.length > 2 && ["co", "com", "net", "org", "ltd"].includes(host[host.length - 2]) ? host.slice(0, -2) : host.slice(0, -1);
  const label = core[core.length - 1] || "";
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function place(raw: unknown): HubPlace {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { text: str(r.text, 120), code: str(r.code, 8).toUpperCase(), country: str(r.country, 2).toUpperCase() };
}

/** "INMAA - Chennai", or just the code or the text. */
export function placeLabel(p: HubPlace): string {
  if (p.code && p.text && p.text.toLowerCase() !== p.code.toLowerCase()) return `${p.code} - ${p.text}`;
  return p.code || p.text;
}

/** The forwarder is in India: leaving India is an export, arriving is an import. */
export function directionFromCountries(origin: string, destination: string): HubDirection | null {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  if (!o || !d) return null;
  if (o === "IN" && d !== "IN") return "export";
  if (d === "IN" && o !== "IN") return "import";
  if (o === "IN" && d === "IN") return "unknown";
  return "unknown"; // between two foreign countries
}

export function normalizeContainerType(raw: string): string {
  const m = /(\d{2})\s*['′]?\s*(GP|DC|HC|HQ|RF|FR|OT|TK|PL)?/i.exec(raw.replace(/\s+/g, ""));
  if (!m) return raw.trim();
  const size = m[1];
  let kind = (m[2] || "GP").toUpperCase();
  if (kind === "DC") kind = "GP";
  if (kind === "HQ") kind = "HC";
  return `${size}'${kind}`;
}

function packages(raw: unknown): HubPackage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p): HubPackage | null => {
      const r = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
      const qty = numOrNull(r.qty) ?? 1;
      const out: HubPackage = { qty: Math.max(1, Math.round(qty)) };
      const gw = numOrNull(r.gw);
      const l = numOrNull(r.l);
      const w = numOrNull(r.w);
      const h = numOrNull(r.h);
      if (gw !== null) out.gw = gw;
      if (l !== null) out.l = l;
      if (w !== null) out.w = w;
      if (h !== null) out.h = h;
      const description = str(r.description, 120);
      if (description) out.description = description;
      return gw !== null || l !== null ? out : null;
    })
    .filter((p): p is HubPackage => p !== null)
    .slice(0, 60);
}

export interface AgentRef {
  name: string;
  email?: string;
  location?: string;
}

export interface NormalizeContext {
  ownDomains?: string[];
  /** The sender header read from the email file itself. */
  headerSender?: { name: string; email: string };
  agents?: AgentRef[];
}

export interface NormalizedJobFields {
  extraction: HubExtraction;
  customer: string;
  senderEmail: string;
  senderName: string;
}

function guessMode(x: { containers: unknown[]; volumeCbm: number | null; grossWeightKg: number | null; seaMode: string | null }): HubMode {
  if (x.containers.length || x.seaMode || (x.volumeCbm ?? 0) > 20) return "sea";
  return "air";
}

const MODES: HubMode[] = ["air", "sea", "courier", "transport", "warehouse"];

export function normalizeExtraction(raw: unknown, ctx: NormalizeContext = {}): NormalizedJobFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const own = ctx.ownDomains ?? OWN_EMAIL_DOMAINS;
  const needsCheck: HubExtraction["needsCheck"] = (Array.isArray(r.needsCheck) ? r.needsCheck : [])
    .map((n) => {
      const o = (n && typeof n === "object" ? n : {}) as Record<string, unknown>;
      return { field: str(o.field, 40), note: str(o.note, 200) };
    })
    .filter((n) => n.field || n.note)
    .slice(0, 12);

  const containers = (Array.isArray(r.containers) ? r.containers : [])
    .map((c) => {
      const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      return { type: normalizeContainerType(str(o.type, 20)), qty: Math.max(1, Math.round(numOrNull(o.qty) ?? 1)) };
    })
    .filter((c) => c.type)
    .slice(0, 10);
  const seaRaw = str(r.seaMode, 4).toLowerCase();
  const seaMode = seaRaw === "fcl" || seaRaw === "lcl" ? (seaRaw as "fcl" | "lcl") : null;
  const grossWeightKg = numOrNull(r.grossWeightKg);
  const volumeCbm = numOrNull(r.volumeCbm);

  // Mode: the AI's answer, else a safe guess that is flagged for checking.
  let mode: HubMode;
  const modeRaw = str(r.mode, 12).toLowerCase();
  if ((MODES as string[]).includes(modeRaw)) mode = modeRaw as HubMode;
  else {
    mode = guessMode({ containers, volumeCbm, grossWeightKg, seaMode });
    needsCheck.unshift({ field: "mode", note: "Could not tell Air from Sea from the documents — please check." });
  }

  const origin = place(r.origin);
  const destination = place(r.destination);

  // Import / Export: the countries decide when they are clear; otherwise the AI's reading is kept.
  const fromCountries = directionFromCountries(origin.country, destination.country);
  const aiDir = str(r.direction, 8).toLowerCase();
  let direction: HubDirection = aiDir === "export" || aiDir === "import" ? aiDir : "unknown";
  let directionReason = str(r.directionReason, 200);
  if (fromCountries && fromCountries !== "unknown") {
    if (direction !== fromCountries) directionReason = `${origin.country} → ${destination.country}`;
    direction = fromCountries;
  }
  if (direction === "unknown" && (mode === "air" || mode === "sea")) {
    needsCheck.push({ field: "direction", note: directionReason || "Could not tell Import from Export — please choose." });
  }

  // Sender: a colleague's address is never the customer.
  const sRaw = (r.sender && typeof r.sender === "object" ? r.sender : {}) as Record<string, unknown>;
  let senderEmail = str(sRaw.email, 120).toLowerCase();
  let senderName = str(sRaw.name, 80);
  let company = str(sRaw.company, 120);
  if (senderEmail && isInternalEmail(senderEmail, own)) {
    senderEmail = "";
    senderName = "";
    company = "";
  }
  const header = ctx.headerSender;
  if (!senderEmail && header?.email && !isInternalEmail(header.email, own)) {
    senderEmail = header.email.toLowerCase();
    senderName = senderName || header.name || "";
  }
  if (!company && senderEmail) company = companyFromDomain(senderEmail);

  // Tidy against the agents list, so one agent never appears under three spellings.
  let customer = company;
  if (company) {
    const hit = (ctx.agents ?? []).find(
      (a) =>
        (senderEmail && a.email && a.email.toLowerCase() === senderEmail) ||
        (normalizeAgentName(a.name) && sameAgent({ name: a.name, email: a.email, location: a.location }, { name: company, email: senderEmail })),
    );
    if (hit) customer = hit.name;
  }

  const extraction: HubExtraction = {
    mode,
    modeReason: str(r.modeReason, 200),
    direction,
    directionReason,
    sender: { name: senderName, email: senderEmail, company },
    origin,
    destination,
    incoterm: str(r.incoterm, 8).toUpperCase(),
    commodity: str(r.commodity, 120),
    hsCode: str(r.hsCode, 20),
    currency: str(r.currency, 3).toUpperCase(),
    invoiceValue: numOrNull(r.invoiceValue),
    grossWeightKg,
    volumeCbm,
    packages: packages(r.packages),
    containers,
    seaMode,
    specialHandling: (Array.isArray(r.specialHandling) ? r.specialHandling : []).map((s) => str(s, 120)).filter(Boolean).slice(0, 8),
    notes: str(r.notes, 400),
    vehicleType: str(r.vehicleType, 60),
    storageLocation: str(r.storageLocation, 80),
    storageDays: numOrNull(r.storageDays),
    storageCbm: numOrNull(r.storageCbm),
    needsCheck,
    summary: str(r.summary, 200),
  };
  return { extraction, customer, senderEmail, senderName };
}
