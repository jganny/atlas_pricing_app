/**
 * Vertex Guide — a built-in, offline "how do I…?" assistant. It ranks the
 * entries below against what the user types (keyword + phrase scoring) and
 * shows page-aware tips. No text leaves the browser. Add a feature = add an entry.
 */

export interface GuideEntry {
  id: string;
  title: string;
  /** Route prefix where this feature lives (used for "on this screen" tips). */
  path: string;
  /** Where to click, in plain words. */
  where: string;
  summary: string;
  steps: string[];
  keywords: string[];
  href?: string;
}

export const GUIDE: GuideEntry[] = [
  {
    id: "sales-pipeline",
    title: "Lead pipeline (list & board)",
    path: "/sales",
    where: "Sales → Pipeline",
    summary: "Capture leads, move them through stages, log calls/notes, and quote straight from a lead.",
    steps: [
      "Click New lead, fill company + contact, Create.",
      "Switch List / Board at the top; drag a card on the Board to change its stage.",
      "Click a lead to open details, log a call/email/meeting under Activity.",
    ],
    keywords: ["lead", "pipeline", "board", "kanban", "stage", "prospect", "follow up", "follow-up", "activity", "log call"],
    href: "/sales",
  },
  {
    id: "sales-edit",
    title: "Edit a lead, link an account, set probability",
    path: "/sales",
    where: "Sales → Pipeline → open a lead → Edit",
    summary: "Change any lead field, link it to an Account/Contact, and set win probability and expected close date.",
    steps: [
      "Open a lead and click Edit.",
      "Pick an Account (then a Contact on it), set Win probability % and Expected close date.",
      "Leave probability blank to use the stage default (new 10, contacted 25, qualified 50, quoted 70).",
    ],
    keywords: ["edit lead", "probability", "close date", "expected close", "account", "contact", "link"],
    href: "/sales",
  },
  {
    id: "sales-loss",
    title: "Record why a lead was lost",
    path: "/sales",
    where: "Sales → Pipeline → lead → Edit (status = lost)",
    summary: "A structured loss reason (price, timing, competitor…) feeds the 'Why we lose' report.",
    steps: [
      "Set the lead's status to lost.",
      "Click 'add one' in the amber notice or Edit, choose a Loss reason, Save.",
    ],
    keywords: ["loss", "lost", "lose", "losing", "reason", "why we lose", "why did we lose", "win loss", "win/loss", "competitor"],
    href: "/sales",
  },
  {
    id: "sales-linked-quotes",
    title: "Quote from lead & linked quotes",
    path: "/sales",
    where: "Sales → Pipeline → lead → Quote from lead",
    summary: "Opens the Air/Sea desk pre-filled. When you save, the quote is linked back and appears under 'Linked quotes' on the lead.",
    steps: [
      "Open a lead → Quote from lead.",
      "Finish and Save the quote on the desk.",
      "Back on the lead, the quote is listed under Linked quotes (green). 'Possible matches' are older name-based guesses.",
    ],
    keywords: ["quote from lead", "linked quotes", "possible matches", "convert", "lead to quote"],
    href: "/sales",
  },
  {
    id: "sales-accounts",
    title: "Accounts & contacts",
    path: "/sales",
    where: "Sales → Accounts",
    summary: "One record per customer company with multiple contacts, territory and renewal date. You own what you create; admins can reassign.",
    steps: [
      "Sales → Accounts → New account (you become the owner).",
      "Click the account to edit details and add contacts.",
    ],
    keywords: ["account", "accounts", "contacts", "customer", "company", "owner", "territory", "renewal"],
    href: "/sales",
  },
  {
    id: "sales-forecast",
    title: "Forecast & lead score",
    path: "/sales",
    where: "Sales → Forecast",
    summary: "Open pipeline vs probability-weighted forecast by stage and close month, plus open leads ranked by score.",
    steps: [
      "Open Sales → Forecast.",
      "Hover any score badge to see exactly which factors added or removed points.",
      "Leads with no expected close date sit under 'No close date' — set one via Edit.",
    ],
    keywords: ["forecast", "weighted", "score", "lead score", "scoring", "pipeline value", "probability", "close month"],
    href: "/sales",
  },
  {
    id: "sales-renewals",
    title: "Renewals & upsell prompts",
    path: "/sales",
    where: "Sales → Renewals",
    summary: "Lists accounts whose contract renewal is due within 60 days (or overdue) and customer accounts with no quote or win for 90+ days, with a one-click follow-up lead.",
    steps: [
      "Set a Contract renewal date and Account type = customer on the Accounts tab.",
      "Open Sales → Renewals to see who needs attention and why.",
      "Click Create follow-up lead to add a lead due today; accounts that already have an open lead show 'Open lead exists'.",
    ],
    keywords: ["renewal", "renewals", "renew", "upsell", "cross sell", "re-engage", "gone quiet", "inactive", "contract", "agreement expiry", "dormant", "repeat"],
    href: "/sales",
  },
  {
    id: "sales-targets",
    title: "Sales targets, quotas & territories",
    path: "/sales",
    where: "Sales → Targets",
    summary: "Admins set a revenue (and optional win-count) target per rep, territory or the whole team for a calendar quarter. Progress counts leads marked won in that quarter.",
    steps: [
      "Sales → Targets, choose the quarter.",
      "Admins: pick Who, enter the revenue goal, Save target (saving again for the same person and quarter updates it).",
      "Add territories at the bottom, then pick one on an account and set a team target for it.",
    ],
    keywords: ["target", "targets", "quota", "quotas", "attainment", "goal", "territory", "territories", "quarter", "progress"],
    href: "/sales",
  },
  {
    id: "sales-permissions",
    title: "Who can edit leads and accounts",
    path: "/sales",
    where: "Sales (all tabs)",
    summary: "You can edit your own leads and accounts; admins can edit everything. Leads with no owner (from the old app) stay editable by anyone. Others' records show 'View only'.",
    steps: [
      "A 'View only — owned by …' label means the record belongs to someone else; ask them or an admin.",
      "Admins can reassign an account's owner and manage targets and territories.",
    ],
    keywords: ["permission", "permissions", "view only", "cannot edit", "can't edit", "access", "owner", "reassign", "locked", "who can"],
    href: "/sales",
  },
  {
    id: "sales-analytics",
    title: "Win rate, deal size, cycle time & rep leaderboard",
    path: "/analytics",
    where: "Analytics → Sales pipeline performance",
    summary: "Win rate (won ÷ won+lost), average won deal, average sales cycle, loss reasons and a won-revenue leaderboard.",
    steps: [
      "Open Analytics and scroll to Sales pipeline performance.",
      "Cycle time only counts leads closed since the close-date stamping began (v0.3.43).",
    ],
    keywords: ["win rate", "average deal", "cycle time", "sales cycle", "leaderboard", "rep", "analytics", "performance"],
    href: "/analytics",
  },
  {
    id: "edb-report-builder",
    title: "Report builder (airline / coloader / liner / POL / POD / tonnage)",
    path: "/enquiries",
    where: "Enquiry DB → Report builder",
    summary: "Group the quotes in your current view by any combination and download it as CSV. Your Enquiry DB filters apply first.",
    steps: [
      "Set the filters you want (dates, status, customer…), then click Report builder.",
      "Tap a preset (Airline-wise, Coloader-wise, Liner-wise, POL-wise, POD-wise, Tonnage-wise) or pick your own Group by order.",
      "Optionally limit Carrier type, choose Sort by, then Download CSV.",
    ],
    keywords: ["report", "reports", "airline wise", "coloader", "liner", "pol", "pod", "tonnage", "export", "csv", "download", "group by", "combination", "excel"],
    href: "/enquiries",
  },
  {
    id: "edb-csv",
    title: "Export Enquiry DB rows",
    path: "/enquiries",
    where: "Enquiry DB → Export",
    summary: "Downloads the rows in your current filtered view (one line per quote).",
    steps: ["Apply filters, then click the export/CSV button in the header."],
    keywords: ["export", "csv", "download", "enquiry db", "quotation logs", "rows"],
    href: "/enquiries",
  },
  {
    id: "autofill-history",
    title: "Automatic charges from your quote history",
    path: "/air",
    where: "Air and Sea desks (automatic)",
    summary: "After Origin, Destination and Incoterm are set, charges that were the same across earlier matching quotes fill in silently. Anything you typed is never overwritten; inconsistent charges stay blank.",
    steps: [
      "Fill Origin, Destination, Incoterm, Currency, then type the carrier name on the Carriers step.",
      "Wait about a second — matching freight/AMS/surcharge cells fill in. Edit them freely.",
    ],
    keywords: ["autofill", "auto fill", "prefill", "history", "previous quote", "same charges", "consistent", "carrier charges", "auto"],
    href: "/air",
  },
  {
    id: "desk-keys",
    title: "Keyboard: Tab between steps, ⌘S to save",
    path: "/air",
    where: "Any quote desk",
    summary: "Tab on the last field of a step moves to the next step; Alt+1–3 jump to a step; ⌘S saves.",
    steps: ["Press Tab past 'Next · Carriers' to land on the carrier step.", "Press Alt+1/2/3 to jump steps, ⌘S (Ctrl+S) to save."],
    keywords: ["tab", "keyboard", "shortcut", "next", "step", "save", "alt", "hotkey"],
    href: "/air",
  },
  {
    id: "fx-override",
    title: "Custom USD→INR override",
    path: "/air",
    where: "Air / Sea desk → Shipment",
    summary: "Only changes the INR-equivalent stored with the quote (Enquiry DB reporting). It never changes the customer-facing total.",
    steps: ["Leave blank to use 83.5, or enter today's rate; the preview under the field shows the INR figure."],
    keywords: ["fx", "exchange", "usd", "inr", "override", "rate", "currency", "custom"],
    href: "/air",
  },
  {
    id: "multi-lane",
    title: "Multi-lane quotes & 'Quoted' vs 'Lowest'",
    path: "/air",
    where: "Air / Sea desk → Add lane",
    summary: "Add a lane per origin→destination. 'Quoted offer' is the option you're recommending on that lane; ★ Lowest is the cheapest, shown for comparison. Totals are shown per lane.",
    steps: ["Click Add lane, enter the extra route, add carriers to that lane.", "Pick which carrier is Quoted on each lane."],
    keywords: ["lane", "multi", "multiple", "quoted", "lowest", "cheapest", "origin destination", "o/d", "add lane"],
    href: "/air",
  },
  {
    id: "share-whatsapp",
    title: "Share a quote (PDF, email, WhatsApp)",
    path: "/air",
    where: "Quote preview → Download / Email / WhatsApp",
    summary: "Download saves the PDF. Email attaches it. WhatsApp opens WhatsApp Web with the message and downloads the PDF to attach (phones use the native share sheet).",
    steps: ["Open Preview on a desk.", "Choose Download, Email or WhatsApp; on desktop attach the downloaded PDF in WhatsApp."],
    keywords: ["whatsapp", "share", "pdf", "email", "download quote", "send quote", "preview"],
    href: "/air",
  },
  {
    id: "refresh-banner",
    title: "'App updated — Refresh now' banner",
    path: "/",
    where: "Top of any page after a release",
    summary: "Appears once when a newer version has loaded. Click Refresh now to finish the update.",
    steps: ["Click Refresh now once; if you don't see it, do a hard refresh (⌘⇧R)."],
    keywords: ["refresh", "update", "banner", "new version", "stale", "cache", "version"],
  },
  {
    id: "vertex-ask",
    title: "Ask Vertex (find quotes & open desks)",
    path: "/",
    where: "Sparkle button, bottom-right (or ⌘?)",
    summary: "Type a customer, lane or 'new air quote BOM to LHR' and Vertex opens the right screen.",
    steps: ["Press ⌘? or click the sparkle button and type what you need."],
    keywords: ["ask", "vertex", "search", "find quote", "assistant", "help", "open"],
  },
];

const STOP = new Set(["the", "a", "an", "to", "of", "in", "on", "for", "how", "do", "i", "can", "what", "is", "my", "and", "or", "it", "does", "where", "get", "use", "with", "me", "this"]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9/ -]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

function stem(t: string): string {
  return t.length > 4 ? t.replace(/(ing|ed|es|s)$/, "") : t;
}

export interface GuideHit {
  entry: GuideEntry;
  score: number;
}

/** Ranked matches; a phrase hit in keywords outweighs loose word overlap. Empty query → []. */
export function searchGuide(query: string, pathname = ""): GuideHit[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const qt = tokens(q).map(stem);
  const hits: GuideHit[] = [];
  for (const entry of GUIDE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.includes(" ") ? 6 : 4;
    }
    const hay = tokens(`${entry.title} ${entry.summary} ${entry.where} ${entry.keywords.join(" ")}`).map(stem);
    for (const t of qt) if (hay.includes(t)) score += 1;
    if (score > 0 && pathname && pathname.startsWith(entry.path) && entry.path !== "/") score += 1;
    if (score > 0) hits.push({ entry, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** Tips for the screen the user is on. */
export function tipsForPath(pathname: string): GuideEntry[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  const match = GUIDE.filter((e) => e.path !== "/" && (p === e.path || p.startsWith(`${e.path}/`)));
  if (match.length) return match;
  if (p === "/sea") return GUIDE.filter((e) => e.path === "/air");
  return GUIDE.filter((e) => e.path === "/");
}
