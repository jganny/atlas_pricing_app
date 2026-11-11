/**
 * Labels on an enquiry, worked out from its words by fixed rules (no AI credit). They show as small tags on the list and as folders.
 */
import type { InboxEnquiry } from "@/lib/types";
import { parseClientDeadline } from "./reply-by";

export type LabelKey = "dg" | "pharma" | "perishable" | "deadline" | "attachment";

export const LABEL_NAMES: Record<LabelKey, string> = {
  dg: "Dangerous goods",
  pharma: "Pharma",
  perishable: "Perishable",
  deadline: "Client deadline",
  attachment: "Attachment only",
};

const DG = /\b(dgr|dangerous goods?|hazmat|hazardous|imdg|imo class|un ?\d{4}|class [1-9](?:\.\d)?\b|lithium|battery|batteries|flammable|corrosive)\b/i;
const PHARMA = /\b(pharma|pharmaceutical|api\b|medicine|medicines|vaccine|vaccines|drug|drugs|biologic|cold chain|cool chain|temperature[- ]controlled|2\s?[-–to]+\s?8\s?°?c|15\s?[-–to]+\s?25\s?°?c|gdp)\b/i;
const PERISHABLE = /\b(perishable|fresh|fruits?|vegetables?|flowers?|seafood|fish|meat|frozen|chilled|reefer|dairy|cut flowers)\b/i;

/** The labels of an enquiry, from its subject and preview. */
export function labelsOf(item: Pick<InboxEnquiry, "subject" | "bodyPreview" | "body" | "attachmentCount" | "receivedAt" | "from">): LabelKey[] {
  const text = `${item.subject || ""}\n${item.bodyPreview || item.body || ""}`;
  const out: LabelKey[] = [];
  if (DG.test(text)) out.push("dg");
  if (PHARMA.test(text)) out.push("pharma");
  if (PERISHABLE.test(text)) out.push("perishable");
  const received = Date.parse(item.receivedAt || "");
  if (parseClientDeadline(text, Number.isFinite(received) ? received : Date.now(), 330)) out.push("deadline");
  // Almost nothing written, but files attached: the details are in the attachment.
  const words = (item.bodyPreview || item.body || "").trim().split(/\s+/).filter(Boolean).length;
  if ((item.attachmentCount ?? 0) > 0 && words <= 12) out.push("attachment");
  return out;
}
