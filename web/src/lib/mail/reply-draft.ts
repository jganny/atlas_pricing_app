import type { InboxEnquiry } from "@/lib/types";

export interface EnquiryUnderstanding {
  understood: string[];
  missing: string[];
}

function cargoText(item: InboxEnquiry, mode: "air" | "sea"): string {
  const p = item.parsed;
  if (!p) return "";
  if (mode === "sea" && p.containers?.length) {
    return p.containers.map((c) => `${c.qty} × ${c.type}`).join(", ");
  }
  if (p.packages?.length) {
    const pieces = p.packages.reduce((n, x) => n + (x.qty || 0), 0);
    const kg = p.grossWeight ? `, ${p.grossWeight} kg` : "";
    return `${pieces || p.packages.length} package${pieces === 1 ? "" : "s"}${kg}`;
  }
  if (p.grossWeight) return `${p.grossWeight} kg`;
  if (p.volume) return `${p.volume} cbm`;
  return "";
}

/**
 * What a customer enquiry already tells us, and what a rate quote still needs
 * that the email doesn't say. Deterministic on purpose — the AI only words
 * the reply; it never decides what counts as missing.
 */
export function understandEnquiry(item: InboxEnquiry, mode: "air" | "sea"): EnquiryUnderstanding {
  const p = item.parsed;
  const understood: string[] = [];
  const missing: string[] = [];

  if (p?.origin && p?.destination) understood.push(`${p.origin} → ${p.destination}`);
  else missing.push("origin and destination");

  const cargo = cargoText(item, mode);
  if (cargo) understood.push(cargo);
  else missing.push(mode === "sea" ? "container type and quantity" : "cargo weight and dimensions");

  if (p?.commodity) understood.push(p.commodity);
  else missing.push("commodity");

  if (p?.incoterm) understood.push(p.incoterm);
  else missing.push("Incoterm");

  return { understood, missing };
}

/** First email address inside "Name <addr@x.com>" or a bare address; "" when none. */
export function senderEmail(from: string): string {
  const m = (from || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : "";
}

/** Display name from "Name <addr>" (or the local part of a bare address). */
export function senderFirstName(from: string): string {
  const named = (from || "").replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
  const base = named && !named.includes("@") ? named : senderEmail(from).split("@")[0].replace(/[._-]+/g, " ");
  const first = base.trim().split(/\s+/)[0] || "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

export function replySubject(subject: string): string {
  const s = (subject || "").trim();
  if (!s) return "Re: your enquiry";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/** Plain, price-free reply used when AI is unavailable (and in the public demo). */
export function basicReplyDraft(
  item: InboxEnquiry,
  mode: "air" | "sea",
  signOff = "Pricing Team",
): { subject: string; body: string } {
  const { understood, missing } = understandEnquiry(item, mode);
  const name = senderFirstName(item.from);
  const lines: string[] = [`Hi ${name || "there"},`, ""];
  lines.push(
    understood.length
      ? `Thank you for your enquiry. We have noted: ${understood.join(" · ")}.`
      : "Thank you for your enquiry.",
  );
  lines.push("");
  if (missing.length) {
    lines.push("To give you an accurate quote, could you please confirm:");
    for (const m of missing) lines.push(`  • ${m}`);
    lines.push("", "We'll share rates as soon as we have these.");
  } else {
    lines.push("We're preparing your rates and will share them shortly.");
  }
  lines.push("", "Best regards,", signOff);
  return { subject: replySubject(item.subject), body: lines.join("\n") };
}

export function mailtoHref(to: string, subject: string, body: string): string {
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?${q}`;
}
