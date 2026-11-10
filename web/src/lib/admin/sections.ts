/**
 * Admin console — the list of sections and how to find one.
 *
 * Every section the administrator can open is listed here once: where it sits, what it is called, a plain-words line about it,
 * extra words people might type to look for it ("forgot" finds the password queue), and who may see it.
 * Adding a section later means adding one entry here and one line where it is drawn; search, the grouped list, the phone
 * picker and the link to each section all follow from this list.
 */

export type AdminIcon =
  | "users"
  | "userplus"
  | "key"
  | "pin"
  | "wallet"
  | "repeat"
  | "timer"
  | "calendar"
  | "spark"
  | "chat"
  | "eye"
  | "alert"
  | "history"
  | "activity"
  | "mail"
  | "database";

/** Who sees a section. Rules mirror what the Admin page already did before it was reorganised. */
export type AdminRule =
  | "admin" // any administrator
  | "ganny" // the main administrator only
  | "ganny-live" // the main administrator, in the live app only (needs the real database)
  | "ganny-or-demo"; // the main administrator, or anyone in the demo

export interface AdminSectionDef {
  id: string;
  group: string;
  title: string;
  blurb: string;
  keywords: string;
  icon: AdminIcon;
  rule: AdminRule;
}

export const GROUP_ORDER = ["People and access", "Customers and quotes", "AI and cost", "Team chat", "Health and records", "Setup and tests"] as const;

export const SECTIONS: AdminSectionDef[] = [
  { id: "desk-seats", group: "People and access", title: "Desk seats", icon: "users", rule: "admin", blurb: "Assign or clear the person sitting in each desk. Seat names never change.", keywords: "who sits seat owner swap occupant air sea nrs free hand" },
  { id: "register-desk-user", group: "People and access", title: "Register desk user", icon: "userplus", rule: "admin", blurb: "Add a new login for someone joining a desk.", keywords: "new login joiner account add user create" },
  { id: "password-reset-queue", group: "People and access", title: "Password reset queue", icon: "key", rule: "admin", blurb: "Requests from people who forgot their password.", keywords: "forgot locked out reset login" },
  { id: "login-branch", group: "People and access", title: "Which branch does a login quote from?", icon: "pin", rule: "admin", blurb: "Choose the office a login quotes from.", keywords: "branch office location login" },
  { id: "visit-report-options", group: "Customers and quotes", title: "Visit report options", icon: "chat", rule: "admin", blurb: "The tap-to-pick answers in a sales visit report: add, rename, reorder or hide them.", keywords: "sales visit report questions purpose commodity scope options choices suggestions" },
  { id: "auto-replies", group: "Customers and quotes", title: "Automatic replies", icon: "mail", rule: "ganny-live", blurb: "Acknowledge enquiries and shipment confirmations by email, copy the branch team, and see what was sent.", keywords: "auto reply acknowledgement acknowledge email enquiry confirmation nrs branch team cc test send" },
  { id: "customer-credit-control", group: "Customers and quotes", title: "Customer credit control", icon: "wallet", rule: "admin", blurb: "Credit days, limits and blocked customers.", keywords: "credit days limit block agreement overdue" },
  { id: "priority-convert-capture", group: "Customers and quotes", title: "Priority convert capture", icon: "repeat", rule: "admin", blurb: "Record shipper and consignee when a quote converts.", keywords: "convert won shipper consignee parties nrs" },
  { id: "time-to-quote", group: "Customers and quotes", title: "Time to quote", icon: "timer", rule: "admin", blurb: "How long desks take from opening to a saved quote.", keywords: "speed minutes performance how long" },
  { id: "branch-holiday-calendar", group: "Customers and quotes", title: "Branch holiday calendar", icon: "calendar", rule: "admin", blurb: "Customs and branch holidays used in transit times.", keywords: "holiday customs closed days calendar" },
  { id: "ai-credit-and-cost", group: "AI and cost", title: "AI credit and cost", icon: "spark", rule: "ganny-live", blurb: "Credit left, what each month cost, and the low-balance warning.", keywords: "money spend balance anthropic top up claude bill rupees dollars" },
  { id: "ask-vertex-usage", group: "AI and cost", title: "Ask Vertex usage", icon: "spark", rule: "admin", blurb: "Who asked Ask Vertex questions this month.", keywords: "questions assistant who asked searches" },
  { id: "chat-only-staff", group: "Team chat", title: "Chat-only staff", icon: "chat", rule: "ganny-live", blurb: "Logins for people who only use Vertex Chat, and their private join links.", keywords: "vertex chat login invite link join password" },
  { id: "team-chat-review", group: "Team chat", title: "Team chat review", icon: "eye", rule: "ganny-or-demo", blurb: "Audited review of chat messages under company policy.", keywords: "read chats audit messages policy" },
  { id: "error-monitor", group: "Health and records", title: "Error monitor", icon: "alert", rule: "admin", blurb: "Problems the app has reported, newest first.", keywords: "errors crashes broken problems bugs" },
  { id: "audit-trail", group: "Health and records", title: "Audit trail", icon: "history", rule: "admin", blurb: "Who changed what, and when.", keywords: "history log changes who" },
  { id: "sign-ins-activity", group: "Health and records", title: "Sign-ins and activity", icon: "activity", rule: "ganny", blurb: "Who has signed in and how they use the app.", keywords: "login history sessions who logged in" },
  { id: "test-sending-email", group: "Setup and tests", title: "Test sending email", icon: "mail", rule: "ganny", blurb: "Send yourself one test message from the pricing mailbox.", keywords: "mail smtp rate request send test" },
  { id: "firebase-reconnect", group: "Setup and tests", title: "Firebase config / reconnect", icon: "database", rule: "admin", blurb: "Database connection and map key settings.", keywords: "database connection keys google maps" },
];

export interface AdminContext {
  isAdmin: boolean;
  isGanny: boolean;
  live: boolean;
}

export function canSee(rule: AdminRule, ctx: AdminContext): boolean {
  if (!ctx.isAdmin) return false;
  switch (rule) {
    case "admin":
      return true;
    case "ganny":
      return ctx.isGanny;
    case "ganny-live":
      return ctx.isGanny && ctx.live;
    case "ganny-or-demo":
      return ctx.isGanny || !ctx.live;
  }
}

/** The sections this person may see, in the order of the groups, then the order listed. */
export function visibleSections(ctx: AdminContext, all: AdminSectionDef[] = SECTIONS): AdminSectionDef[] {
  const rank = (g: string) => {
    const i = (GROUP_ORDER as readonly string[]).indexOf(g);
    return i < 0 ? GROUP_ORDER.length : i;
  };
  return all
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => canSee(s.rule, ctx))
    .sort((a, b) => rank(a.s.group) - rank(b.s.group) || a.i - b.i)
    .map(({ s }) => s);
}

export function groupSections(list: AdminSectionDef[]): Array<{ group: string; items: AdminSectionDef[] }> {
  const out: Array<{ group: string; items: AdminSectionDef[] }> = [];
  for (const s of list) {
    const last = out[out.length - 1];
    if (last && last.group === s.group) last.items.push(s);
    else out.push({ group: s.group, items: [s] });
  }
  return out;
}

/** How well one word matches one section: title start 5, in title 4, extra words 3, blurb 2, group 1, no match 0. */
function wordScore(s: AdminSectionDef, word: string): number {
  const t = s.title.toLowerCase();
  if (t.startsWith(word)) return 5;
  if (t.includes(word)) return 4;
  if (s.keywords.includes(word)) return 3;
  if (s.blurb.toLowerCase().includes(word)) return 2;
  if (s.group.toLowerCase().includes(word)) return 1;
  return 0;
}

/** Sections matching what was typed, best first. Every word typed must match something, so "reset password" is narrower than "reset". */
export function searchSections(query: string, list: AdminSectionDef[]): AdminSectionDef[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return list
    .map((s, i) => {
      const scores = words.map((w) => wordScore(s, w));
      return { s, i, total: scores.some((x) => x === 0) ? 0 : scores.reduce((a, b) => a + b, 0) };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total || a.i - b.i)
    .map((x) => x.s);
}

/** The link to a section ("#password-reset-queue") and back; unknown or hidden ones give null so the page falls back gracefully. */
export function hashFor(id: string): string {
  return `#${id}`;
}
export function sectionFromHash(hash: string, list: AdminSectionDef[]): string | null {
  const id = String(hash || "").replace(/^#/, "");
  return list.some((s) => s.id === id) ? id : null;
}

/** Recently opened sections, newest first, never listing one that is hidden or gone. */
export const RECENT_KEY = "atlas_admin_recent";
export function parseRecent(raw: string | null, list: AdminSectionDef[]): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    const ok = new Set(list.map((s) => s.id));
    return arr.filter((x): x is string => typeof x === "string" && ok.has(x)).slice(0, 6);
  } catch {
    return [];
  }
}
export function pushRecent(recent: string[], id: string, max = 6): string[] {
  return [id, ...recent.filter((x) => x !== id)].slice(0, max);
}
