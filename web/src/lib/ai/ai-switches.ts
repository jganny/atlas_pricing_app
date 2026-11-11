/**
 * The AI on/off switch. One master switch and one per place the app uses AI. When a switch is off the server refuses the AI call
 * with a plain message; nothing is lost and the work is done by hand. Missing or unreadable means ON, so a fault never silences the app.
 * This file is the list people see: where each AI feature appears, what it costs, and who it is for.
 */

export type AiGroupId = "quoteHub" | "mailbox" | "circulars" | "askVertex" | "help" | "replyDrafts" | "instruction" | "vendorRate" | "rateReplies" | "agencyList";

export interface AiGroupInfo {
  id: AiGroupId;
  name: string;
  /** Where in the app a user meets it. */
  where: string;
  /** The model and a rough cost, in words people can use. */
  cost: string;
  /** Who can use it. */
  who: string;
}

export const AI_GROUPS: AiGroupInfo[] = [
  { id: "quoteHub", name: "Quote Hub reading", where: "Quote Hub and the Inbox: reading an enquiry's attachments to fill the shipment details", cost: "Haiku 5.5 · about ₹1 per enquiry, only when someone chooses it", who: "Air and Sea desks" },
  { id: "mailbox", name: "Mailbox sorting and confirmation reading", where: "Behind the scenes: sorting new mail in pricing@ and pricingsales@, reading booking confirmations", cost: "Haiku 5.5 · a few paise per mail, automatic every 2 minutes", who: "Runs by itself" },
  { id: "circulars", name: "Circular reading", where: "Carrier Board and Library: reading airline and shipping-line circulars into tariffs", cost: "Haiku 5.5 · about ₹1 to ₹3 per circular, once per circular", who: "Air and Sea desks, Admin" },
  { id: "askVertex", name: "Ask Vertex", where: "Ask Vertex chat", cost: "Haiku 5.5 · under ₹1 per question", who: "All users" },
  { id: "help", name: "App help assistant", where: "The help button: answers 'how do I…' questions about the app", cost: "Haiku 5.5 · under ₹1 per question", who: "All users" },
  { id: "replyDrafts", name: "Enquiry reply drafts", where: "Inbox: the suggested reply to a customer", cost: "Haiku 5.5 · about ₹1 per draft, only when someone asks", who: "Air and Sea desks" },
  { id: "instruction", name: "Quote by instruction", where: "Quote Hub: typing an instruction such as 'quote 500 kg to Dubai'", cost: "Haiku 5.5 · under ₹1 per instruction", who: "Air and Sea desks" },
  { id: "vendorRate", name: "Vendor rate from a document", where: "Air and Sea desks: reading a rate sheet or email from a vendor", cost: "Haiku 5.5 · about ₹1 to ₹2 per document", who: "Air and Sea desks" },
  { id: "rateReplies", name: "Vendor and agent rates from emails", where: "Air and Sea desks and the Inbox conversation: reading a vendor's or overseas agent's email into rates", cost: "Haiku 5.5 · about ₹0.30 or less per email, only when someone presses Read rates", who: "Air and Sea desks" },
  { id: "agencyList", name: "Agency list check", where: "Weekly email that checks the agency list", cost: "Haiku 5.5 · a few rupees per week, automatic", who: "Runs by itself" },
];

export interface AiSwitches {
  master: boolean;
  groups: Record<AiGroupId, boolean>;
}

/** Everything on: what the app assumes until the server says otherwise. */
export function allOn(): AiSwitches {
  const groups = {} as Record<AiGroupId, boolean>;
  for (const g of AI_GROUPS) groups[g.id] = true;
  return { master: true, groups };
}

/** Server answer -> switches. Anything missing or not a clear `false` is on. */
export function readSwitches(raw: unknown): AiSwitches {
  const out = allOn();
  const d = (raw && typeof raw === "object" ? raw : {}) as { master?: unknown; groups?: Record<string, unknown> };
  if (d.master === false) out.master = false;
  for (const g of AI_GROUPS) if (d.groups && d.groups[g.id] === false) out.groups[g.id] = false;
  return out;
}

/** Is this place allowed to use AI right now? The master switch beats the single ones. */
export function aiAllowed(sw: AiSwitches | null | undefined, group: AiGroupId): boolean {
  if (!sw) return true;
  return sw.master && sw.groups[group] !== false;
}

/** One line for the top bar and for tooltips. */
export function aiStatusText(sw: AiSwitches | null | undefined): { label: string; tone: "on" | "partial" | "off"; detail: string } {
  const s = sw ?? allOn();
  if (!s.master) return { label: "AI off", tone: "off", detail: "AI is switched off by your admin. Everything that used AI is done by hand." };
  const off = AI_GROUPS.filter((g) => s.groups[g.id] === false);
  if (!off.length) return { label: "AI on", tone: "on", detail: "AI is on for every feature." };
  return { label: `AI on · ${off.length} off`, tone: "partial", detail: `AI is off for: ${off.map((g) => g.name).join(", ")}.` };
}

/** Plain message shown in place of an AI button that is switched off. */
export function aiOffMessage(sw: AiSwitches | null | undefined, group: AiGroupId): string {
  const info = AI_GROUPS.find((g) => g.id === group);
  if (sw && !sw.master) return "AI is switched off by your admin, so this is done by hand. Nothing is lost.";
  return `AI reading for ${info ? info.name : "this feature"} is switched off by your admin, so this is done by hand. Nothing is lost.`;
}
