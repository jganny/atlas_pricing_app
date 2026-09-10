/** Lightweight desk intent — Vertex acts on what you type, not just FAQ. */

import { classifyQuoteMode } from "@/lib/pricing/quote-mode";

export type QuoteMode = "air" | "sea" | "courier" | "transport" | "warehouse";

export type DeskIntent =
  | { kind: "find"; query: string }
  | { kind: "new"; mode: QuoteMode; origin?: string; dest?: string }
  | { kind: "goto"; href: string; label: string }
  | { kind: "help"; topic: string };

const MODE_PATH: Record<QuoteMode, string> = {
  air: "/air",
  sea: "/sea",
  courier: "/courier",
  transport: "/transport",
  warehouse: "/warehouse",
};

function detectMode(p: string): QuoteMode | null {
  return classifyQuoteMode(p);
}

function laneFrom(p: string): { origin?: string; dest?: string } {
  const code = p.match(/\b([a-z]{3})\s*(?:to|→|-|–)\s*([a-z]{3})\b/i);
  if (code) return { origin: code[1].toUpperCase(), dest: code[2].toUpperCase() };
  const cleaned = p.replace(
    /\b(quote|quotes|air|sea|courier|new|start|create|make|desk|freight|from)\b/gi,
    " ",
  );
  const m = cleaned.match(
    /\b([a-z]{3}|[a-z][a-z ]{2,18})\s+(?:to|→|-|–)\s+([a-z]{3}|[a-z][a-z ]{2,18})\b/i,
  );
  if (!m) return {};
  return { origin: m[1].trim(), dest: m[2].trim() };
}

function stripFindPrefix(p: string): string {
  return p
    .replace(
      /^(find|search|show|open|get|look\s*up|retrieve|where\s+is|pull)\s+(me\s+)?(the\s+)?(old\s+)?(saved\s+)?(quote|quotes|file)?\s*(for|of|named)?\s*/i,
      "",
    )
    .replace(/\bquotes?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDeskIntent(raw: string): DeskIntent {
  const text = raw.trim();
  const p = text.toLowerCase();
  if (!p) return { kind: "help", topic: "" };

  if (/\b(overdue|sla|due soon|late)\b/.test(p)) {
    return { kind: "goto", href: "/enquiries", label: "Open Enquiry DB (sort by SLA on Home)" };
  }
  if (/\b(inbox|email|mail)\b/.test(p)) {
    return { kind: "goto", href: "/inbox", label: "Open inbox" };
  }
  if (/\b(circular|tariff|rate card)\b/.test(p)) {
    return { kind: "goto", href: "/circulars", label: "Open Circulars" };
  }
  if (/\b(enquiry db|edb|database)\b/.test(p)) {
    return { kind: "goto", href: "/enquiries", label: "Open Enquiry DB" };
  }
  if (/\b(backup|offline)\b/.test(p)) {
    return { kind: "help", topic: "offline" };
  }
  if (/\b(performance|who quoted|officers|users)\b/.test(p)) {
    return { kind: "help", topic: "performance" };
  }

  const wantNew =
    /\b(new|start|create|make)\b/.test(p) || /^(air|sea|courier)\s+(quote|desk)/.test(p);
  const mode = detectMode(p);
  const lane = laneFrom(p);
  if (wantNew && mode) {
    return { kind: "new", mode, ...lane };
  }
  if (mode && (lane.origin || lane.dest) && !/\b(find|search|old|saved)\b/.test(p)) {
    return { kind: "new", mode, ...lane };
  }

  if (
    /\b(find|search|show|open|old|saved|retrieve|look\s*up|where)\b/.test(p) ||
    (!mode && text.length >= 2)
  ) {
    const query = stripFindPrefix(text) || text;
    if (query.length >= 2) return { kind: "find", query };
  }

  if (mode) {
    return { kind: "goto", href: MODE_PATH[mode], label: `Open ${mode} desk` };
  }

  return { kind: "find", query: text };
}

export function newQuoteHref(intent: Extract<DeskIntent, { kind: "new" }>): string {
  const path = MODE_PATH[intent.mode];
  const params = new URLSearchParams();
  if (intent.origin) params.set("origin", intent.origin);
  if (intent.dest) params.set("dest", intent.dest);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
